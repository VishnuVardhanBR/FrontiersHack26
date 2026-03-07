import mammoth from "mammoth";
import pdfParse from "pdf-parse";

export interface UploadLike {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

export class DocumentExtractorService {
  async extractText(file: UploadLike): Promise<string> {
    const fileName = file.originalname.toLowerCase();

    if (file.mimetype === "application/pdf" || fileName.endsWith(".pdf")) {
      const parsed = await pdfParse(file.buffer);
      return parsed.text.trim();
    }

    if (
      file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      fileName.endsWith(".docx")
    ) {
      const parsed = await mammoth.extractRawText({ buffer: file.buffer });
      return parsed.value.trim();
    }

    return file.buffer.toString("utf8").trim();
  }
}
