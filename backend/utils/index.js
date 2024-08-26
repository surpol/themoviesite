function cosineSimilarity(vecA, vecB) {
    const dotProduct = vecA.reduce((sum, a, idx) => sum + a * vecB[idx], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  
    return dotProduct / (magnitudeA * magnitudeB);
}
  
function calculateAverageEmbedding(embeddings) {
    const numEmbeddings = embeddings.length;
    const embeddingLength = embeddings[0].length;
  
    const averageEmbedding = new Array(embeddingLength).fill(0);
  
    embeddings.forEach(embedding => {
      for (let i = 0; i < embeddingLength; i++) {
        averageEmbedding[i] += embedding[i];
      }
    });
  
    return averageEmbedding.map(value => value / numEmbeddings);
}

module.exports = { cosineSimilarity, calculateAverageEmbedding };
