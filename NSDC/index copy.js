const forge = require('node-forge');

// Example public key and secret (as provided)
const examplePublicKey = `-----BEGIN PUBLIC KEY-----\n    MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAwEkDY4EfQsnlpCovvuCG\n    IupEKKflUuo5aGae4cpJ+h9B5f/sLEwIQICYKzOp/2c1Ksik7SUt+9re/mk9NaZT\n    NK9sZ4Y626gNd+BwXG9lXeBTHNklmXe9uKMuhjLQC2opzjwnNNcvJ1SUledrVIJN\n    qvx9GOGnf9F5kXTrLwncMGMzY3Bl+uikn16Z72UlDvh2Czy0D+O64icUdB3c0iHz\n    FUlYRY9DpWMZtuHzRyMDMuDWLFT6hFlkZGbRHC6qSx0NGEGUdBJ/VMPZveRXxfhP\n    mJ8CXp7b5u1b+LEbkMTqz24q7i4Uc6Wy5bz4uysNf5/2ZDehyI0184NBu7939Ktz\n    VGsK1W6jvqWoQTfzKIB0ChB7FZgN4Wd+mgdz0K+2E/w+2vcpASIEbXNBwxPY2gpT\n    CW7WrDl8IeSu7lit8QOroWMBVz/OivRQgnr8pyANbAuwJh7ki2yop6jlfC8HEmhg\n    L2tCFdkFtVbcIGRjZeUmVQaHV4W13JkNr73PCVvefA5APKpKQXCVg7tdvEYPQgC/\n    D1wxgYWSaZ7nM/8gcjta1C22c1tBmVGBAudd6xR4nDL7F9AbXLbckWFtKN4yh8oo\n    nyJVDq/04HTg0xMBJA54UK8cXkKu7mudcShOyT+j0vw1TlZ2c/PPnx+Bt5fqGQow\n    DNS8HyyJqdQ3lEJI9HmSORECAwEAAQ==\n    -----END PUBLIC KEY-----\n`;
const exampleSecret = '3i5IO';

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
    const password = 'ekaushal';  // Replace with the actual password you want to encrypt
    const clientSecret = generateClientSecret(password);
    console.log('Generated Client Secret:', clientSecret);
  } catch (error) {
    console.error('Error generating client secret:', error);
  }
})();
