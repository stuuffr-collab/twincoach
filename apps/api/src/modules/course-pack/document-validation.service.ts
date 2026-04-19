import { Injectable } from "@nestjs/common";
import { SourceDocumentParseStatus, SourceDocumentValidationStatus } from "@prisma/client";
import { PDFParse } from "pdf-parse";
import {
  COURSE_PACK_BLOCKED_TEXT_COVERAGE_THRESHOLD,
  COURSE_PACK_LOW_TEXT_COVERAGE_THRESHOLD,
  COURSE_PACK_MAX_PAGE_COUNT,
  COURSE_PACK_MIN_TEXT_CHARACTERS,
  COURSE_PACK_TEXT_PREVIEW_LENGTH,
} from "./course-pack.constants";
import { DocumentValidationResult } from "./course-pack.types";

@Injectable()
export class DocumentValidationService {
  async validatePdfBuffer(buffer: Buffer): Promise<DocumentValidationResult> {
    try {
      const parser = new PDFParse({ data: buffer });
      const parsedPdf = await parser.getText();
      await parser.destroy();

      const pageCount = normalizePageCount(parsedPdf.total);
      const normalizedText = normalizeText(parsedPdf.text ?? "");
      const nonWhitespaceLength = normalizedText.replace(/\s+/g, "").length;
      const textCoverageRatio = calculateTextCoverageRatio({
        pageCount,
        nonWhitespaceLength,
      });
      const hasSelectableText =
        nonWhitespaceLength >= COURSE_PACK_MIN_TEXT_CHARACTERS;

      if (!pageCount || pageCount <= 0) {
        return buildRejectedResult({
          parseStatus: SourceDocumentParseStatus.failed,
          pageCount: null,
          textCoverageRatio: 0,
          hasSelectableText: false,
          blockingIssueCode: "parse_failed_no_pages",
          warningCodes: [],
        });
      }

      if (pageCount > COURSE_PACK_MAX_PAGE_COUNT) {
        return buildRejectedResult({
          parseStatus: SourceDocumentParseStatus.blocked,
          pageCount,
          textCoverageRatio,
          hasSelectableText,
          blockingIssueCode: "page_count_exceeded",
          warningCodes: [],
        });
      }

      if (
        !hasSelectableText ||
        textCoverageRatio < COURSE_PACK_BLOCKED_TEXT_COVERAGE_THRESHOLD
      ) {
        return buildRejectedResult({
          parseStatus: SourceDocumentParseStatus.blocked,
          pageCount,
          textCoverageRatio,
          hasSelectableText,
          blockingIssueCode: "ocr_required",
          warningCodes: [],
        });
      }

      if (textCoverageRatio < COURSE_PACK_LOW_TEXT_COVERAGE_THRESHOLD) {
        return {
          validationStatus: SourceDocumentValidationStatus.valid,
          parseStatus: SourceDocumentParseStatus.partial,
          parseConfidenceScore: roundScore(
            Math.max(0.35, Math.min(0.69, textCoverageRatio + 0.2)),
          ),
          pageCount,
          hasSelectableText: true,
          textCoverageRatio,
          textPreview: normalizedText.slice(0, COURSE_PACK_TEXT_PREVIEW_LENGTH),
          warningCodes: ["low_text_coverage"],
          blockingIssueCode: null,
        };
      }

      return {
        validationStatus: SourceDocumentValidationStatus.valid,
        parseStatus: SourceDocumentParseStatus.parsed,
        parseConfidenceScore: roundScore(
          Math.max(0.7, Math.min(0.99, textCoverageRatio + 0.1)),
        ),
        pageCount,
        hasSelectableText: true,
        textCoverageRatio,
        textPreview: normalizedText.slice(0, COURSE_PACK_TEXT_PREVIEW_LENGTH),
        warningCodes: [],
        blockingIssueCode: null,
      };
    } catch (error) {
      const blockingIssueCode = isEncryptedPdfError(error)
        ? "encrypted_pdf"
        : "corrupted_pdf";

      return buildRejectedResult({
        parseStatus: SourceDocumentParseStatus.blocked,
        pageCount: null,
        textCoverageRatio: 0,
        hasSelectableText: false,
        blockingIssueCode,
        warningCodes: [],
      });
    }
  }
}

function buildRejectedResult(input: {
  parseStatus: SourceDocumentParseStatus;
  pageCount: number | null;
  textCoverageRatio: number;
  hasSelectableText: boolean;
  blockingIssueCode: string;
  warningCodes: string[];
}): DocumentValidationResult {
  return {
    validationStatus: SourceDocumentValidationStatus.rejected,
    parseStatus: input.parseStatus,
    parseConfidenceScore: 0,
    pageCount: input.pageCount,
    hasSelectableText: input.hasSelectableText,
    textCoverageRatio: input.textCoverageRatio,
    textPreview: null,
    warningCodes: input.warningCodes,
    blockingIssueCode: input.blockingIssueCode,
  };
}

function normalizePageCount(value: number | undefined) {
  if (!value || Number.isNaN(value)) {
    return null;
  }

  return Math.max(0, Math.trunc(value));
}

function normalizeText(value: string) {
  return value.replace(/\u0000/g, "").replace(/\s+/g, " ").trim();
}

function calculateTextCoverageRatio(input: {
  pageCount: number | null;
  nonWhitespaceLength: number;
}) {
  if (!input.pageCount || input.pageCount <= 0) {
    return 0;
  }

  const expectedCharacters = Math.max(300, input.pageCount * 300);
  const ratio = input.nonWhitespaceLength / expectedCharacters;

  return roundScore(Math.max(0, Math.min(1, ratio)));
}

function roundScore(value: number) {
  return Math.round(value * 100) / 100;
}

function isEncryptedPdfError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes("password") || message.includes("encrypted");
}
