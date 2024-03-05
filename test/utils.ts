import Web3 from "web3";

export function subtractMonths(numOfMonths = 18, date = new Date()) {
  date.setMonth(date.getMonth() - numOfMonths);
  return date;
}

export function generateEpochTimestamps(startDate = new Date(), numberOfPayments = 36) {
  // Payments should be due at midnight
  startDate.setHours(0, 0, 0, 0);
  
  // Add 18 months
  startDate.setMonth(startDate.getMonth() + 18); 

  // Initialize an array to store the timestamps
  const timestamps = [];

  // Generate 18 timestamps, each 1 month apart from the previous
  for (let i = 0; i < numberOfPayments; i++) {
    timestamps.push(Math.floor(startDate.getTime() / 1000));
    startDate.setMonth(startDate.getMonth() + 1); // Add 1 month
  }

  return timestamps;
}

export function convertBytesToString(bytesValue) {
  // Remove the '0x' prefix and convert to a byte array
  let bytes = new Uint8Array(bytesValue.substring(2).match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

  // Decode the bytes to a string
  let decoder = new TextDecoder('utf-8');
  let stringValue = decoder.decode(bytes);
  
  return stringValue;
}

export function convertUInt256ToBytes(uint256Value) {
  // Ensure the input is treated as a BigInt
  let bigIntValue = BigInt(uint256Value);

  // Convert the BigInt to a hexadecimal string
  let hexString = bigIntValue.toString(16);

  // Pad the string to ensure it represents 256 bits (64 hex characters)
  let paddedHexString = hexString.padStart(64, '0');

  // Convert the padded hexadecimal string to bytes and prefix with '0x'
  return '0x' + paddedHexString;
}

export function convertBytesToInt256(bytesValue) {
  // Remove the '0x' prefix
  let hexString = bytesValue.startsWith('0x') ? bytesValue.slice(2) : bytesValue;

  // Convert the hexadecimal string to a BigInt
  let bigIntValue = BigInt('0x' + hexString);

  // Check if the value is negative by looking at the most significant bit
  const isNegative = bigIntValue & BigInt('0x8000000000000000000000000000000000000000000000000000000000000000');

  // If the value is negative, we manually compute the two's complement
  if (isNegative) {
    const invertedN = ~bigIntValue; // Bitwise NOT
    const twosComplement = invertedN + BigInt(1); // Add 1 to get the two's complement
    return -twosComplement; // Return the negative value
  }

  return bigIntValue; // Return the positive value as is
}


export function createKeccak256Hash(dataKey) {
  const web3 = new Web3();
  const hash = web3.utils.soliditySha3(dataKey);
  return hash
}
