export interface AiGenerationResult {
  imageBuffer: Buffer;
  contentType: string;
}

export interface AiProvider {
  generate(imageBase64: string): Promise<AiGenerationResult>;
}
