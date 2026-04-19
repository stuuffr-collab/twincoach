import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { COURSE_PACK_MAX_FILE_SIZE_BYTES } from "./course-pack.constants";
import { CoursePackActivationService } from "./course-pack-activation.service";
import { CoursePackConfirmationService } from "./course-pack-confirmation.service";
import { CoursePackExtractionService } from "./course-pack-extraction.service";
import { CoursePackService } from "./course-pack.service";

@Controller("course-packs")
export class CoursePackController {
  constructor(
    private readonly coursePackService: CoursePackService,
    private readonly coursePackExtractionService: CoursePackExtractionService,
    private readonly coursePackConfirmationService: CoursePackConfirmationService,
    private readonly coursePackActivationService: CoursePackActivationService,
  ) {}

  @Get()
  listCoursePacks(@Headers("x-learner-id") learnerId?: string) {
    if (!learnerId) {
      throw new BadRequestException("Missing x-learner-id");
    }

    return this.coursePackService.listCoursePacks(learnerId);
  }

  @Post()
  createCoursePack(
    @Headers("x-learner-id") learnerId: string | undefined,
    @Body()
    body: {
      courseTitle?: string;
      courseCode?: string;
      institutionLabel?: string;
      termLabel?: string;
      primaryLanguage?: string;
    },
  ) {
    if (!body.courseTitle?.trim()) {
      throw new BadRequestException("Missing courseTitle");
    }

    const allowedKeys = [
      "courseTitle",
      "courseCode",
      "institutionLabel",
      "termLabel",
      "primaryLanguage",
    ];
    const bodyKeys = Object.keys(body);

    if (bodyKeys.some((key) => !allowedKeys.includes(key))) {
      throw new BadRequestException("Invalid course pack payload");
    }

    return this.coursePackService.createCoursePack({
      learnerId,
      courseTitle: body.courseTitle,
      courseCode: body.courseCode,
      institutionLabel: body.institutionLabel,
      termLabel: body.termLabel,
      primaryLanguage: body.primaryLanguage,
    });
  }

  @Get(":coursePackId")
  getCoursePack(
    @Param("coursePackId") coursePackId: string,
    @Headers("x-learner-id") learnerId?: string,
  ) {
    if (!learnerId) {
      throw new BadRequestException("Missing x-learner-id");
    }

    if (!coursePackId) {
      throw new BadRequestException("Missing coursePackId");
    }

    return this.coursePackService.getCoursePack(coursePackId, learnerId);
  }

  @Post(":coursePackId/extraction")
  runExtraction(
    @Param("coursePackId") coursePackId: string,
    @Headers("x-learner-id") learnerId: string | undefined,
  ) {
    if (!learnerId) {
      throw new BadRequestException("Missing x-learner-id");
    }

    if (!coursePackId) {
      throw new BadRequestException("Missing coursePackId");
    }

    return this.coursePackExtractionService.runExtraction({
      learnerId,
      coursePackId,
    });
  }

  @Get(":coursePackId/extraction")
  getLatestExtraction(
    @Param("coursePackId") coursePackId: string,
    @Headers("x-learner-id") learnerId: string | undefined,
  ) {
    if (!learnerId) {
      throw new BadRequestException("Missing x-learner-id");
    }

    if (!coursePackId) {
      throw new BadRequestException("Missing coursePackId");
    }

    return this.coursePackExtractionService.getLatestExtraction({
      learnerId,
      coursePackId,
    });
  }

  @Post(":coursePackId/confirmations")
  createConfirmationSnapshot(
    @Param("coursePackId") coursePackId: string,
    @Headers("x-learner-id") learnerId: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    if (!learnerId) {
      throw new BadRequestException("Missing x-learner-id");
    }

    if (!coursePackId) {
      throw new BadRequestException("Missing coursePackId");
    }

    const allowedKeys = [
      "confirmedUnitCandidateIds",
      "confirmedConceptCandidateIds",
      "unitEdits",
      "conceptEdits",
      "removedItemIds",
      "reorderedUnitIds",
      "mergeActions",
      "examImportantConceptIds",
      "irrelevantItemIds",
      "acknowledgeLowConfidence",
    ];

    if (Object.keys(body).some((key) => !allowedKeys.includes(key))) {
      throw new BadRequestException("Invalid confirmation payload");
    }

    return this.coursePackConfirmationService.createConfirmation({
      learnerId,
      coursePackId,
      payload: body,
    });
  }

  @Get(":coursePackId/confirmations/latest")
  getLatestConfirmationSnapshot(
    @Param("coursePackId") coursePackId: string,
    @Headers("x-learner-id") learnerId: string | undefined,
  ) {
    if (!learnerId) {
      throw new BadRequestException("Missing x-learner-id");
    }

    if (!coursePackId) {
      throw new BadRequestException("Missing coursePackId");
    }

    return this.coursePackConfirmationService.getLatestConfirmation({
      learnerId,
      coursePackId,
    });
  }

  @Post(":coursePackId/activate")
  activateCoursePack(
    @Param("coursePackId") coursePackId: string,
    @Headers("x-learner-id") learnerId: string | undefined,
    @Body() body: { confirmationSnapshotId?: string },
  ) {
    if (!learnerId) {
      throw new BadRequestException("Missing x-learner-id");
    }

    if (!coursePackId) {
      throw new BadRequestException("Missing coursePackId");
    }

    const allowedKeys = ["confirmationSnapshotId"];

    if (Object.keys(body).some((key) => !allowedKeys.includes(key))) {
      throw new BadRequestException("Invalid activation payload");
    }

    return this.coursePackActivationService.activatePack({
      learnerId,
      coursePackId,
      confirmationSnapshotId: body.confirmationSnapshotId,
    });
  }

  @Post(":coursePackId/archive")
  archiveCoursePack(
    @Param("coursePackId") coursePackId: string,
    @Headers("x-learner-id") learnerId: string | undefined,
  ) {
    if (!learnerId) {
      throw new BadRequestException("Missing x-learner-id");
    }

    if (!coursePackId) {
      throw new BadRequestException("Missing coursePackId");
    }

    return this.coursePackService.archiveCoursePack({
      learnerId,
      coursePackId,
    });
  }

  @Post(":coursePackId/documents")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: {
        fileSize: COURSE_PACK_MAX_FILE_SIZE_BYTES,
      },
    }),
  )
  uploadDocument(
    @Param("coursePackId") coursePackId: string,
    @Headers("x-learner-id") learnerId: string | undefined,
    @UploadedFile() file: unknown,
  ) {
    if (!learnerId) {
      throw new BadRequestException("Missing x-learner-id");
    }

    if (!coursePackId) {
      throw new BadRequestException("Missing coursePackId");
    }

    return this.coursePackService.uploadDocument({
      learnerId,
      coursePackId,
      file: file as {
        originalname?: string;
        mimetype?: string;
        size?: number;
        buffer?: Buffer;
      },
    });
  }

  @Post(":coursePackId/documents/:documentId/replace")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: {
        fileSize: COURSE_PACK_MAX_FILE_SIZE_BYTES,
      },
    }),
  )
  replaceDocument(
    @Param("coursePackId") coursePackId: string,
    @Param("documentId") documentId: string,
    @Headers("x-learner-id") learnerId: string | undefined,
    @UploadedFile() file: unknown,
  ) {
    if (!learnerId) {
      throw new BadRequestException("Missing x-learner-id");
    }

    if (!coursePackId || !documentId) {
      throw new BadRequestException("Missing route identifiers");
    }

    return this.coursePackService.replaceDocument({
      learnerId,
      coursePackId,
      documentId,
      file: file as {
        originalname?: string;
        mimetype?: string;
        size?: number;
        buffer?: Buffer;
      },
    });
  }

  @Post(":coursePackId/documents/:documentId/remove")
  @HttpCode(200)
  removeDocument(
    @Param("coursePackId") coursePackId: string,
    @Param("documentId") documentId: string,
    @Headers("x-learner-id") learnerId: string | undefined,
  ) {
    if (!learnerId) {
      throw new BadRequestException("Missing x-learner-id");
    }

    if (!coursePackId || !documentId) {
      throw new BadRequestException("Missing route identifiers");
    }

    return this.coursePackService.removeDocument({
      learnerId,
      coursePackId,
      documentId,
    });
  }

  @Post(":coursePackId/documents/:documentId/role")
  @HttpCode(200)
  confirmDocumentRole(
    @Param("coursePackId") coursePackId: string,
    @Param("documentId") documentId: string,
    @Headers("x-learner-id") learnerId: string | undefined,
    @Body()
    body: {
      confirmedRole?: string;
    },
  ) {
    const allowedKeys = ["confirmedRole"];
    const bodyKeys = Object.keys(body);

    if (bodyKeys.length !== allowedKeys.length) {
      throw new BadRequestException("Invalid role payload");
    }

    if (!learnerId) {
      throw new BadRequestException("Missing x-learner-id");
    }

    if (!coursePackId || !documentId) {
      throw new BadRequestException("Missing route identifiers");
    }

    if (!body.confirmedRole) {
      throw new BadRequestException("Missing confirmedRole");
    }

    return this.coursePackService.confirmDocumentRole({
      learnerId,
      coursePackId,
      documentId,
      confirmedRole: body.confirmedRole,
    });
  }
}
