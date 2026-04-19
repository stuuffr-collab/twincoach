import { Injectable } from "@nestjs/common";
import { SourceDocument, SourceDocumentRole } from "@prisma/client";
import { PDFParse } from "pdf-parse";
import { CoursePackStorageService } from "./course-pack-storage.service";
import { ParsedDocumentText } from "./course-pack.types";

@Injectable()
export class CoursePackDocumentReaderService {
  constructor(
    private readonly coursePackStorageService: CoursePackStorageService,
  ) {}

  async readDocument(document: SourceDocument): Promise<ParsedDocumentText> {
    const buffer = await this.coursePackStorageService.readDocument(
      document.storageKey,
    );
    const parser = new PDFParse({ data: buffer });

    try {
      const textResult = await parser.getText();

      return {
        documentId: document.id,
        confirmedRole: (document.confirmedRole ??
          document.suggestedRole ??
          SourceDocumentRole.unknown) as SourceDocumentRole,
        originalFilename: document.originalFilename,
        pageCount: textResult.total,
        parseConfidenceScore: document.parseConfidenceScore ?? 0,
        pages: textResult.pages.map((page) => ({
          pageNumber: page.num,
          text: page.text,
        })),
      };
    } finally {
      await parser.destroy();
    }
  }
}
