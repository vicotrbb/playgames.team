import OpenAI from "openai";

export interface ImageGenerationResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
}

export interface EmbeddingResult {
  success: boolean;
  embedding?: number[];
  error?: string;
}

export interface SimilarityScore {
  playerId: string;
  similarity: number;
  points: number;
}

export class OpenAIService {
  private openai: OpenAI | null = null;
  private isConfigured: boolean = false;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      console.warn(
        "⚠️  OPENAI_API_KEY not found. Image generation and scoring will be disabled."
      );
      return;
    }

    this.openai = new OpenAI({
      apiKey: apiKey,
    });

    this.isConfigured = true;
    console.log("✅ OpenAI API configured");
  }

  async generateImage(prompt: string): Promise<ImageGenerationResult> {
    if (!this.isConfigured || !this.openai) {
      return {
        success: false,
        error: "OpenAI API not configured",
      };
    }

    if (!prompt || prompt.trim().length === 0) {
      return {
        success: false,
        error: "Prompt cannot be empty",
      };
    }

    try {
      console.log(`🎨 Generating image for prompt: "${prompt}"`);

      // Modify the prompt to make it more challenging by adding creative interpretation instructions
      const enhancedPrompt = `Create an abstract, artistic, and stylized interpretation of: "${prompt.trim()}". Make it creative and interpretative rather than literal - use artistic styles, unusual angles, creative compositions, or symbolic representations. The image should capture the essence or mood rather than being a direct representation. Add artistic flair, interesting lighting, or creative visual metaphors.`;

      const response = await this.openai.images.generate({
        model: "dall-e-3",
        prompt: enhancedPrompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
        response_format: "url",
      });

      if (!response.data || response.data.length === 0) {
        return {
          success: false,
          error: "No image generated",
        };
      }

      const imageUrl = response.data[0].url;
      if (!imageUrl) {
        return {
          success: false,
          error: "No image URL received",
        };
      }

      console.log(`✅ Image generated successfully`);

      return {
        success: true,
        imageUrl,
      };
    } catch (error: any) {
      console.error("Error generating image:", error);

      if (error.error?.code === "content_policy_violation") {
        return {
          success: false,
          error: "Content policy violation. Please try a different prompt.",
        };
      }

      if (error.error?.code === "rate_limit_exceeded") {
        return {
          success: false,
          error: "Rate limit exceeded. Please try again later.",
        };
      }

      return {
        success: false,
        error: "Failed to generate image. Please try again.",
      };
    }
  }

  async getTextEmbedding(text: string): Promise<EmbeddingResult> {
    if (!this.isConfigured || !this.openai) {
      return {
        success: false,
        error: "OpenAI API not configured",
      };
    }

    if (!text || text.trim().length === 0) {
      return {
        success: false,
        error: "Text cannot be empty",
      };
    }

    try {
      const response = await this.openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text.trim(),
        encoding_format: "float",
      });

      if (!response.data || response.data.length === 0) {
        return {
          success: false,
          error: "No embedding generated",
        };
      }

      return {
        success: true,
        embedding: response.data[0].embedding,
      };
    } catch (error: any) {
      console.error("Error generating embedding:", error);
      return {
        success: false,
        error: "Failed to generate text embedding",
      };
    }
  }

  async calculateSimilarityScores(
    originalPrompt: string,
    guesses: Map<string, string>
  ): Promise<SimilarityScore[]> {
    if (!this.isConfigured) {
      console.warn("OpenAI not configured, using mock scoring");
      return this.getMockSimilarityScores(originalPrompt, guesses);
    }

    try {
      const promptEmbeddingResult = await this.getTextEmbedding(originalPrompt);
      if (!promptEmbeddingResult.success || !promptEmbeddingResult.embedding) {
        console.error("Failed to get prompt embedding");
        return this.getMockSimilarityScores(originalPrompt, guesses);
      }

      const scores: SimilarityScore[] = [];

      for (const [playerId, guess] of guesses.entries()) {
        const guessEmbeddingResult = await this.getTextEmbedding(guess);

        if (!guessEmbeddingResult.success || !guessEmbeddingResult.embedding) {
          scores.push({
            playerId,
            similarity: 0.1,
            points: 1,
          });
          continue;
        }

        const similarity = this.cosineSimilarity(
          promptEmbeddingResult.embedding,
          guessEmbeddingResult.embedding
        );

        const points = this.similarityToPoints(similarity);

        scores.push({
          playerId,
          similarity,
          points,
        });
      }

      return scores.sort((a, b) => b.similarity - a.similarity);
    } catch (error) {
      console.error("Error calculating similarity scores:", error);
      return this.getMockSimilarityScores(originalPrompt, guesses);
    }
  }

  private cosineSimilarity(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length !== vectorB.length) {
      throw new Error("Vectors must have the same length");
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      normA += vectorA[i] * vectorA[i];
      normB += vectorB[i] * vectorB[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private similarityToPoints(similarity: number): number {
    if (similarity >= 0.9) return 10;
    if (similarity >= 0.8) return 9;
    if (similarity >= 0.7) return 8;
    if (similarity >= 0.6) return 7;
    if (similarity >= 0.5) return 6;
    if (similarity >= 0.4) return 5;
    if (similarity >= 0.3) return 4;
    if (similarity >= 0.2) return 3;
    if (similarity >= 0.1) return 2;
    if (similarity >= 0.05) return 1;
    return 0;
  }

  private getMockSimilarityScores(
    originalPrompt: string,
    guesses: Map<string, string>
  ): SimilarityScore[] {
    const scores: SimilarityScore[] = [];

    for (const [playerId, guess] of guesses.entries()) {
      const similarity = this.simpleStringSimilarity(
        originalPrompt.toLowerCase(),
        guess.toLowerCase()
      );
      const points = this.similarityToPoints(similarity);

      scores.push({
        playerId,
        similarity,
        points,
      });
    }

    return scores.sort((a, b) => b.similarity - a.similarity);
  }

  private simpleStringSimilarity(str1: string, str2: string): number {
    const words1 = new Set(str1.split(/\s+/));
    const words2 = new Set(str2.split(/\s+/));

    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  isAvailable(): boolean {
    return this.isConfigured;
  }
}
