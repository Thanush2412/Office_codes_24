const forge = require('node-forge');

// Example public key and secret (as provided)
const examplePublicKey = `-----BEGIN PUBLIC KEY-----\n    MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAzAG4J/6MtXOmn4aG8O52\n    K/bmvB7kudrA5ZYJxb6Xw7iwREIipnteXBTilJ8dYhh5ZnSNonA+RtFxvditcCK6\n    CykZZmKhqHcNT8eu1AAzbOFipYXj24d/891+r9OntKyqXKvT8eOQJ3x7YcZ4bdc2\n    30lLN4r8ZB2/xGp8MwjIIjw9rvPYcQSQImQJ2xiIH8W728gMOBBkElHPHUJ9wgRU\n    Q0o+4rvYTOsbY3Ai+dyqKvRXIZ2+vEgclbhPob8lUgH5HGeicSWSsBj+0TqZiYAc\n    nmZME5CNkQTO7rIfuaFYVo2BcLA8GCkqMXy6d0F3iIam+SFV973AnNRrfLklSPNh\n    soAKWStrvpYX5vMfPE/VLY9nDAnBsaiPZbF9jMEbjODfi3FyTxCwnjIoiJb6bS2+\n    9++eih9oCqlWNO+6k6amUx0qnK1w4p8G6mJT94ixWRUmI7ivJfkD61S5De8T9rRm\n    gX0Xb09HrTqygM+6jw4UOq12byhdgQ6KqLx3+X3pMWXwlRnM5k82ZmynnjbTqTN1\n    HNZ43HzAWGyIXAZZR47707lbYN2+U+uy5p8Ykaur6cKp98wn2PEOefycHfhoGMTk\n    f+U6adPriWRrzmTgDPxgxEmmCL1lSquS5DKkCTMILISmUXHNkCdKk6upjxZvCOl0\n    FuzusC+WOTnXPG0MiSiFQ6ECAwEAAQ==\n    -----END PUBLIC KEY-----\n`;
const exampleSecret = 'xZd90';

// Function to encrypt the password using the provided public key
function encryptPassword(publicKeyPem, password) {
  const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
  const encryptedPassword = publicKey.encrypt(password, 'RSA-OAEP', {
    md: forge.md.sha256.create()
  });
  return forge.util.encode64(encryptedPassword);
}

// Generate the client secret
function generateClientSecret(password) {
  const encryptedPassword = encryptPassword(examplePublicKey, password);
  return `${encryptedPassword}${exampleSecret}`;
}

// Main execution flow
(async () => {
  try {
    const password = 'Focus@4D';  // Replace with the actual password you want to encrypt
    const clientSecret = generateClientSecret(password);
    console.log('Generated Client Secret:', clientSecret);
  } catch (error) {
    console.error('Error generating client secret:', error);
  }
})();
