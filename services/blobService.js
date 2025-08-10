const { BlobServiceClient } = require('@azure/storage-blob');

const blobService = BlobServiceClient.fromConnectionString(process.env.BLOB_CONN);
const containerClient = blobService.getContainerClient('videos');

async function uploadFile(filePath, blobName) {
  const client = containerClient.getBlockBlobClient(blobName);
  await client.uploadFile(filePath);
  return client.url;   // publicly accessible or signed URL
}

module.exports = { uploadFile };
