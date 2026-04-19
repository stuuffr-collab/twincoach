import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { SourceDocumentRole } from "@prisma/client";
import { createHash } from "node:crypto";
import path from "node:path";
import { PrismaService } from "../../prisma/prisma.service";
import {
  COURSE_PACK_MAX_FILES,
  PDF_MIME_TYPE,
  SOURCE_DOCUMENT_ROLE_VALUES,
} from "./course-pack.constants";
import { mapCoursePackResponse, mapSourceDocumentResponse } from "./course-pack.mapper";
import { CoursePackStateService } from "./course-pack-state.service";
import { CoursePackStorageService } from "./course-pack-storage.service";
import { CoursePackWithDocuments } from "./course-pack.types";
import {
  CoursePackDriftCode,
  CoursePackDriftService,
} from "./course-pack-drift.service";
import { DocumentRoleSuggestionService } from "./document-role-suggestion.service";
import { DocumentValidationService } from "./document-validation.service";
import { UploadedPdfFile } from "./course-pack.types";

@Injectable()
export class CoursePackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coursePackStorageService: CoursePackStorageService,
    private readonly documentValidationService: DocumentValidationService,
    private readonly documentRoleSuggestionService: DocumentRoleSuggestionService,
    private readonly coursePackStateService: CoursePackStateService,
    private readonly coursePackDriftService: CoursePackDriftService,
  ) {}

  async createCoursePack(input: {
    learnerId?: string;
    courseTitle: string;
    courseCode?: string;
    institutionLabel?: string;
    termLabel?: string;
    primaryLanguage?: string;
  }) {
    const learnerId = await this.ensureLearner(input.learnerId);
    const coursePack = await this.prisma.coursePack.create({
      data: {
        learnerId,
        courseTitle: input.courseTitle.trim(),
        courseCode: normalizeOptionalString(input.courseCode),
        institutionLabel: normalizeOptionalString(input.institutionLabel),
        termLabel: normalizeOptionalString(input.termLabel),
        primaryLanguage: normalizeOptionalString(input.primaryLanguage) ?? "unknown",
      },
      include: {
        sourceDocuments: activeSourceDocumentInclude(),
      },
    });

    return mapCoursePackResponse(coursePack);
  }

  async listCoursePacks(learnerId: string) {
    const coursePacks = await this.prisma.coursePack.findMany({
      where: {
        learnerId,
      },
      include: {
        sourceDocuments: activeSourceDocumentInclude(),
      },
    });

    return coursePacks
      .slice()
      .sort(compareCoursePacksForManagement)
      .map(mapCoursePackResponse);
  }

  async getCoursePack(coursePackId: string, learnerId: string) {
    const coursePack = await this.getOwnedCoursePack(coursePackId, learnerId);
    return mapCoursePackResponse(coursePack);
  }

  async archiveCoursePack(input: {
    learnerId: string;
    coursePackId: string;
  }) {
    const coursePack = await this.getOwnedCoursePack(
      input.coursePackId,
      input.learnerId,
    );

    if (coursePack.isActive) {
      throw new BadRequestException(
        "Active course packs must be switched before archiving",
      );
    }

    const archivedCoursePack = await this.prisma.coursePack.update({
      where: {
        id: coursePack.id,
      },
      data: {
        lifecycleState: "archived",
        archivedAt: new Date(),
      },
      include: {
        sourceDocuments: activeSourceDocumentInclude(),
      },
    });

    return mapCoursePackResponse(archivedCoursePack);
  }

  async uploadDocument(input: {
    learnerId: string;
    coursePackId: string;
    file: UploadedPdfFile | undefined;
  }) {
    const coursePack = await this.getOwnedCoursePack(
      input.coursePackId,
      input.learnerId,
    );
    const sourceDocument = await this.createSourceDocumentRecord({
      coursePack,
      file: input.file,
    });
    const refreshedPack = await this.syncCoursePackState(coursePack.id);
    const finalPack =
      (await this.markPendingRefreshIfNeeded(coursePack, ["documents_added"])) ??
      refreshedPack;

    return {
      coursePackId: finalPack.id,
      lifecycleState: finalPack.lifecycleState,
      readinessState: finalPack.readinessState,
      driftStatus: finalPack.driftStatus,
      activeContextState: finalPack.activeContextState,
      document: mapSourceDocumentResponse(sourceDocument),
    };
  }

  async replaceDocument(input: {
    learnerId: string;
    coursePackId: string;
    documentId: string;
    file: UploadedPdfFile | undefined;
  }) {
    const coursePack = await this.getOwnedCoursePack(
      input.coursePackId,
      input.learnerId,
    );
    const existingDocument = await this.prisma.sourceDocument.findFirst({
      where: {
        id: input.documentId,
        coursePackId: coursePack.id,
        removedAt: null,
      },
    });

    if (!existingDocument) {
      throw new NotFoundException("Source document not found");
    }

    await this.createSourceDocumentRecord({
      coursePack,
      file: input.file,
      inheritedConfirmedRole: existingDocument.confirmedRole ?? undefined,
      allowAtCapacity: true,
    });

    await this.prisma.sourceDocument.update({
      where: {
        id: existingDocument.id,
      },
      data: {
        removedAt: new Date(),
        removedReasonCode: "replaced",
      },
    });

    const refreshedPack = await this.syncCoursePackState(coursePack.id);
    const finalPack =
      (await this.markPendingRefreshIfNeeded(coursePack, ["documents_replaced"])) ??
      refreshedPack;

    return mapCoursePackResponse(finalPack);
  }

  async removeDocument(input: {
    learnerId: string;
    coursePackId: string;
    documentId: string;
  }) {
    const coursePack = await this.getOwnedCoursePack(
      input.coursePackId,
      input.learnerId,
    );
    const existingDocument = await this.prisma.sourceDocument.findFirst({
      where: {
        id: input.documentId,
        coursePackId: coursePack.id,
        removedAt: null,
      },
    });

    if (!existingDocument) {
      throw new NotFoundException("Source document not found");
    }

    if (coursePack.sourceDocuments.length <= 1) {
      throw new BadRequestException("At least one active document must remain");
    }

    await this.prisma.sourceDocument.update({
      where: {
        id: existingDocument.id,
      },
      data: {
        removedAt: new Date(),
        removedReasonCode: "removed",
      },
    });

    const refreshedPack = await this.syncCoursePackState(coursePack.id);
    const finalPack =
      (await this.markPendingRefreshIfNeeded(coursePack, ["documents_removed"])) ??
      refreshedPack;

    return mapCoursePackResponse(finalPack);
  }

  async confirmDocumentRole(input: {
    learnerId: string;
    coursePackId: string;
    documentId: string;
    confirmedRole: string;
  }) {
    const coursePack = await this.getOwnedCoursePack(input.coursePackId, input.learnerId);
    const confirmedRole = this.assertRoleValue(input.confirmedRole);

    const sourceDocument = await this.prisma.sourceDocument.findFirst({
      where: {
        id: input.documentId,
        coursePackId: coursePack.id,
        removedAt: null,
      },
    });

    if (!sourceDocument) {
      throw new NotFoundException("Source document not found");
    }

    await this.prisma.sourceDocument.update({
      where: { id: sourceDocument.id },
      data: {
        confirmedRole,
      },
    });

    const refreshedPack = await this.syncCoursePackState(coursePack.id);
    const finalPack =
      (await this.markPendingRefreshIfNeeded(coursePack, [
        "document_roles_changed",
      ])) ?? refreshedPack;

    return {
      coursePackId: finalPack.id,
      documentId: sourceDocument.id,
      confirmedRole,
      lifecycleState: finalPack.lifecycleState,
      readinessState: finalPack.readinessState,
      driftStatus: finalPack.driftStatus,
      activeContextState: finalPack.activeContextState,
    };
  }

  private async createSourceDocumentRecord(input: {
    coursePack: CoursePackWithDocuments;
    file: UploadedPdfFile | undefined;
    inheritedConfirmedRole?: SourceDocumentRole;
    allowAtCapacity?: boolean;
  }) {
    const normalizedFile = this.assertUploadablePdf(input.file);

    if (
      input.allowAtCapacity !== true &&
      input.coursePack.documentCount >= COURSE_PACK_MAX_FILES
    ) {
      throw new BadRequestException("Course pack file limit reached");
    }

    const checksumSha256 = createHash("sha256")
      .update(normalizedFile.buffer)
      .digest("hex");

    const duplicateDocument = await this.prisma.sourceDocument.findUnique({
      where: {
        coursePackId_checksumSha256: {
          coursePackId: input.coursePack.id,
          checksumSha256,
        },
      },
      select: {
        id: true,
      },
    });

    if (duplicateDocument) {
      throw new ConflictException("Duplicate document");
    }

    await this.prisma.coursePack.update({
      where: { id: input.coursePack.id },
      data: {
        lifecycleState: "ingesting",
      },
    });

    const storedDocument = await this.coursePackStorageService.storeDocument({
      learnerId: input.coursePack.learnerId,
      coursePackId: input.coursePack.id,
      checksumSha256,
      originalFilename: normalizedFile.originalname,
      buffer: normalizedFile.buffer,
    });

    try {
      const validationResult =
        await this.documentValidationService.validatePdfBuffer(
          normalizedFile.buffer,
        );
      const roleSuggestion =
        this.documentRoleSuggestionService.suggestRole({
          originalFilename: normalizedFile.originalname,
          textPreview: validationResult.textPreview,
        });

      return await this.prisma.sourceDocument.create({
        data: {
          coursePackId: input.coursePack.id,
          storageKey: storedDocument.storageKey,
          originalFilename: normalizedFile.originalname,
          mimeType: normalizedFile.mimetype,
          byteSize: normalizedFile.size,
          pageCount: validationResult.pageCount,
          checksumSha256,
          validationStatus: validationResult.validationStatus,
          suggestedRole: roleSuggestion.suggestedRole,
          confirmedRole: input.inheritedConfirmedRole ?? null,
          roleConfidenceScore: roleSuggestion.confidenceScore,
          roleReasonCodes: roleSuggestion.reasonCodes,
          alternateRoleCandidates: roleSuggestion.alternateRoles,
          parseStatus: validationResult.parseStatus,
          parseConfidenceScore: validationResult.parseConfidenceScore,
          hasSelectableText: validationResult.hasSelectableText,
          textCoverageRatio: validationResult.textCoverageRatio,
          textPreview: validationResult.textPreview,
          warningCodes: mergeWarningCodes(
            validationResult.warningCodes,
            roleSuggestion.reasonCodes.includes("role_conflict")
              ? ["role_conflict"]
              : [],
          ),
          blockingIssueCode: validationResult.blockingIssueCode,
        },
      });
    } catch (error) {
      await this.coursePackStorageService.removeDocument(storedDocument.storageKey);
      throw error;
    }
  }

  private async getOwnedCoursePack(coursePackId: string, learnerId: string) {
    const coursePack = await this.prisma.coursePack.findFirst({
      where: {
        id: coursePackId,
        learnerId,
      },
      include: {
        sourceDocuments: activeSourceDocumentInclude(),
      },
    });

    if (!coursePack) {
      throw new NotFoundException("Course pack not found");
    }

    return coursePack;
  }

  private async syncCoursePackState(coursePackId: string) {
    const currentPack = await this.prisma.coursePack.findUnique({
      where: { id: coursePackId },
      include: {
        sourceDocuments: activeSourceDocumentInclude(),
      },
    });

    if (!currentPack) {
      throw new NotFoundException("Course pack not found");
    }

    const nextState =
      this.coursePackStateService.deriveState(currentPack.sourceDocuments);

    return this.prisma.coursePack.update({
      where: { id: coursePackId },
      data: {
        lifecycleState: currentPack.isActive ? "active" : nextState.lifecycleState,
        readinessState: nextState.readinessState,
        documentCount: nextState.documentCount,
      },
      include: {
        sourceDocuments: activeSourceDocumentInclude(),
      },
    });
  }

  private async markPendingRefreshIfNeeded(
    coursePack: CoursePackWithDocuments,
    reasonCodes: CoursePackDriftCode[],
  ) {
    const historicalArtifactCount = await this.prisma.extractionSnapshot.count({
      where: {
        coursePackId: coursePack.id,
      },
    });

    if (historicalArtifactCount === 0 && !coursePack.isActive) {
      return null;
    }

    const driftState = this.coursePackDriftService.buildPendingRefreshState({
      isActive: coursePack.isActive,
      reasonCodes: [
        ...coursePack.driftReasonCodes.filter(
          (code): code is CoursePackDriftCode =>
            [
              "documents_added",
              "documents_removed",
              "documents_replaced",
              "document_roles_changed",
              "course_graph_changed",
              "exam_blueprint_changed",
              "support_level_changed",
              "activation_refresh_required",
            ].includes(code),
        ),
        ...reasonCodes,
      ],
    });

    return this.prisma.coursePack.update({
      where: {
        id: coursePack.id,
      },
      data: {
        driftStatus: driftState.driftStatus,
        driftReasonCodes: driftState.driftReasonCodes,
        requiresReconfirmation: driftState.requiresReconfirmation,
        activeContextState: driftState.activeContextState,
      },
      include: {
        sourceDocuments: activeSourceDocumentInclude(),
      },
    });
  }

  private assertUploadablePdf(file: UploadedPdfFile | undefined) {
    if (!file?.buffer || !file.originalname || !file.mimetype || !file.size) {
      throw new BadRequestException("Missing uploaded PDF");
    }

    const filename = file.originalname.trim();
    const extension = path.extname(filename).toLowerCase();
    const headerSignature = file.buffer.subarray(0, 5).toString("utf8");

    if (extension !== ".pdf") {
      throw new BadRequestException("Unsupported file extension");
    }

    if (file.mimetype !== PDF_MIME_TYPE) {
      throw new BadRequestException("Unsupported file type");
    }

    if (headerSignature !== "%PDF-") {
      throw new BadRequestException("Invalid PDF signature");
    }

    return {
      originalname: filename,
      mimetype: file.mimetype,
      size: file.size,
      buffer: file.buffer,
    };
  }

  private assertRoleValue(value: string) {
    if (!SOURCE_DOCUMENT_ROLE_VALUES.includes(value as SourceDocumentRole)) {
      throw new BadRequestException("Invalid confirmedRole");
    }

    return value as SourceDocumentRole;
  }

  private async ensureLearner(learnerId?: string) {
    if (learnerId) {
      const learner = await this.prisma.learner.upsert({
        where: { id: learnerId },
        update: {},
        create: { id: learnerId },
      });

      return learner.id;
    }

    const learner = await this.prisma.learner.create({
      data: {},
    });

    return learner.id;
  }
}

function normalizeOptionalString(value: string | undefined) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}

function mergeWarningCodes(primary: string[], secondary: string[]) {
  return [...new Set([...primary, ...secondary])];
}

function activeSourceDocumentInclude() {
  return {
    where: {
      removedAt: null,
    },
    orderBy: {
      createdAt: "asc",
    } as const,
  };
}

function compareCoursePacksForManagement(
  left: CoursePackWithDocuments,
  right: CoursePackWithDocuments,
) {
  if (left.isActive !== right.isActive) {
    return left.isActive ? -1 : 1;
  }

  const leftArchived = Boolean(left.archivedAt);
  const rightArchived = Boolean(right.archivedAt);

  if (leftArchived !== rightArchived) {
    return leftArchived ? 1 : -1;
  }

  return right.updatedAt.getTime() - left.updatedAt.getTime();
}
