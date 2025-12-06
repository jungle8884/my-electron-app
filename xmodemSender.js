/**
 * XModem Sender class for serial port firmware transfer
 * Handles XModem protocol implementation for sending firmware files
 */
const fs = require('fs').promises;

class XModemSender {
  constructor(port) {
    this.port = port;
    this.crc = true;
    this.retries = 10;
    this.packetSize = 128; // Standard XModem packet size
  }

  /**
   * Send firmware data using XModem protocol
   * @param {Buffer} firmwareData - The firmware data to send
   * @returns {Promise} - Resolves when transfer is complete, rejects on error
   */
  async send(firmwareData) {
    console.log('Starting XModem transfer...');
    console.log('Firmware size:', firmwareData.length, 'bytes');
    console.log('XModem configuration: CRC mode, retries=' + this.retries);
    
    // 确保没有残留的监听器
    this.port.removeAllListeners('data');
    
    // 计算总数据包数
    const totalPackets = Math.ceil(firmwareData.length / this.packetSize);
    let currentPacket = 1;
    let transferComplete = false;
    
    // 使用Promise封装整个传输过程
    return new Promise((resolve, reject) => {
      // 设置总超时时间
      const totalTimeout = setTimeout(() => {
        reject(new Error('XModem transfer timeout after 120 seconds'));
      }, 120000);
      
      /**
       * Send a single XModem packet
       * @param {number} packetNumber - The packet number
       * @param {Buffer} data - The data to send in this packet
       */
      const sendPacket = (packetNumber, data) => {
        // 创建数据包
        const packet = this._createPacket(packetNumber, data);
        
        // 只在特定间隔输出日志，避免日志过多
        if (packetNumber % 100 === 0 || packetNumber === 1 || packetNumber === totalPackets) {
          console.log(`Sending XModem packet ${packetNumber}/${totalPackets}: ${packet.length} bytes`);
        } else if (packetNumber % 10 === 0) {
          // 每10个数据包输出一个点，显示进度
          process.stdout.write('.');
        }
        
        // 发送数据包
        this.port.write(packet, (err) => {
          if (err) {
            console.error('Error writing packet to port:', err.message);
            return handlePacketError();
          }
          
          // 等待ACK响应
          waitForACK(packetNumber);
        });
      };
      
      /**
       * Wait for ACK response from device
       * @param {number} packetNumber - The packet number we're waiting for acknowledgment for
       */
      const waitForACK = (packetNumber) => {
        let receivedData = Buffer.alloc(0);
        const ackTimeout = setTimeout(() => {
          console.error(`Timeout waiting for ACK for packet ${packetNumber}`);
          this.port.removeListener('data', onData);
          handlePacketError();
        }, 5000);
        
        const onData = (data) => {
          receivedData = Buffer.concat([receivedData, data]);
          
          // 检查是否收到ACK (0x06)、NAK (0x15) 或 CAN (0x18)
          if (receivedData.includes(0x06)) { // ACK
            clearTimeout(ackTimeout);
            this.port.removeListener('data', onData);
            handleACK(packetNumber);
          } else if (receivedData.includes(0x15)) { // NAK - resend packet
            clearTimeout(ackTimeout);
            this.port.removeListener('data', onData);
            console.log(`Received NAK for packet ${packetNumber}, resending...`);
            sendPacket(packetNumber, this._getPacketData(firmwareData, packetNumber));
          } else if (receivedData.includes(0x18)) { // CAN - cancel transfer
            clearTimeout(ackTimeout);
            this.port.removeListener('data', onData);
            console.error('Received CAN, transfer cancelled by device');
            clearTimeout(totalTimeout);
            reject(new Error('Transfer cancelled by device'));
          }
        };
        
        this.port.on('data', onData);
      };
      
      /**
       * Handle ACK response for a packet
       * @param {number} packetNumber - The packet number that was acknowledged
       */
      const handleACK = (packetNumber) => {
        // 检查是否还有更多数据包要发送
        if (packetNumber < totalPackets) {
          // 发送下一个数据包
          currentPacket++;
          const nextPacketData = this._getPacketData(firmwareData, currentPacket);
          sendPacket(currentPacket, nextPacketData);
        } else {
          // 添加换行符，确保点号序列后面的日志能正确显示
          console.log();
          // 所有数据包都已发送，发送EOT
          sendEOT();
        }
      };
      
      /**
       * Handle packet transmission error
       */
      const handlePacketError = () => {
        this.retries--;
        if (this.retries > 0) {
          console.log(`Retrying transfer... ${this.retries} retries left`);
          // 重新开始当前数据包的传输
          const packetData = this._getPacketData(firmwareData, currentPacket);
          sendPacket(currentPacket, packetData);
        } else {
          console.error('XModem transfer failed after all retries');
          clearTimeout(totalTimeout);
          reject(new Error('XModem transfer failed after all retries'));
        }
      };
      
      /**
       * Send End of Transmission (EOT) character
       */
      const sendEOT = () => {
        console.log('All packets sent, sending EOT...');
        
        const eotTimeout = setTimeout(() => {
          console.error('Timeout waiting for ACK after EOT');
          this.port.removeListener('data', onEOTData);
          clearTimeout(totalTimeout);
          reject(new Error('Timeout after sending EOT'));
        }, 5000);
        
        const onEOTData = (data) => {
          if (data.includes(0x06)) { // ACK
            clearTimeout(eotTimeout);
            this.port.removeListener('data', onEOTData);
            transferComplete = true;
            clearTimeout(totalTimeout);
            console.log('XModem transfer completed successfully');
            resolve();
          } else if (data.includes(0x15)) { // NAK - resend EOT
            console.log('Received NAK after EOT, resending...');
            this.port.write(Buffer.from([0x04]), () => {
              // 继续等待ACK
            });
          }
        };
        
        this.port.on('data', onEOTData);
        this.port.write(Buffer.from([0x04]), (err) => {
          if (err) {
            console.error('Error sending EOT:', err.message);
            clearTimeout(eotTimeout);
            this.port.removeListener('data', onEOTData);
            clearTimeout(totalTimeout);
            reject(new Error('Failed to send EOT'));
          }
        });
      };
      
      // 设备已准备好，直接开始发送第一个数据包
      const firstPacketData = this._getPacketData(firmwareData, currentPacket);
      sendPacket(currentPacket, firstPacketData);
    });
  }

  /**
   * Create an XModem packet
   * @param {number} packetNumber - The packet number (1-255)
   * @param {Buffer} data - The data to include in the packet (max 128 bytes)
   * @returns {Buffer} - The complete XModem packet
   */
  _createPacket(packetNumber, data) {
    // Ensure packet number is within 1-255 range
    const pktNum = packetNumber % 256;
    
    // Create packet buffer
    const packet = Buffer.alloc(3 + this.packetSize + (this.crc ? 2 : 1));
    
    // Set packet header (SOH)
    packet[0] = 0x01;
    
    // Set packet number
    packet[1] = pktNum;
    
    // Set packet number complement
    packet[2] = 0xFF - pktNum;
    
    // Copy data into packet
    data.copy(packet, 3);
    
    // Pad with Ctrl-Z if data is less than packet size
    if (data.length < this.packetSize) {
      for (let i = data.length; i < this.packetSize; i++) {
        packet[3 + i] = 0x1A; // Ctrl-Z
      }
    }
    
    // Calculate and add checksum or CRC
    if (this.crc) {
      const crcValue = this._calculateCRC(packet.slice(3, 3 + this.packetSize));
      packet[3 + this.packetSize] = (crcValue >> 8) & 0xFF; // MSB first
      packet[3 + this.packetSize + 1] = crcValue & 0xFF;     // LSB second
    } else {
      const checksum = this._calculateChecksum(packet.slice(3, 3 + this.packetSize));
      packet[3 + this.packetSize] = checksum;
    }
    
    return packet;
  }

  /**
   * Get the data for a specific packet
   * @param {Buffer} firmwareData - The complete firmware data
   * @param {number} packetNumber - The packet number (1-based)
   * @returns {Buffer} - The data for the specified packet
   */
  _getPacketData(firmwareData, packetNumber) {
    const startIndex = (packetNumber - 1) * this.packetSize;
    const endIndex = Math.min(startIndex + this.packetSize, firmwareData.length);
    return firmwareData.slice(startIndex, endIndex);
  }

  /**
   * Calculate 8-bit checksum
   * @param {Buffer} data - The data to calculate checksum for
   * @returns {number} - The 8-bit checksum value
   */
  _calculateChecksum(data) {
    let checksum = 0;
    for (let i = 0; i < data.length; i++) {
      checksum += data[i];
      checksum &= 0xFF; // Keep it 8-bit
    }
    return checksum;
  }

  /**
   * Calculate 16-bit CRC
   * @param {Buffer} data - The data to calculate CRC for
   * @returns {number} - The 16-bit CRC value
   */
  _calculateCRC(data) {
    let crc = 0;
    for (let i = 0; i < data.length; i++) {
      crc ^= data[i] << 8;
      for (let j = 0; j < 8; j++) {
        if (crc & 0x8000) {
          crc = (crc << 1) ^ 0x1021;
        } else {
          crc <<= 1;
        }
        crc &= 0xFFFF;
      }
    }
    return crc;
  }
}

module.exports = XModemSender;