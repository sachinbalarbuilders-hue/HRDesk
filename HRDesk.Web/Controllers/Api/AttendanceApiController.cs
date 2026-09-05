namespace HRDesk.Web.Controllers.Api;

// ── Attendance API — Shared DTOs ─────────────────────────────────────────────
// The AttendanceController class has been split into three focused controllers:
//   - AttendanceReportsController    → GET monthly-sheet, summary, daily-logs
//   - MobilePunchController          → POST punch, request-challenge, today-status, day-details, my-monthly, debug-face-scores
//   - AttendanceCorrectionController → GET/POST/PUT/DELETE manual-punch, day, punch/{id}, pair, edit, eligible-employees
//
// All DTOs are defined here to keep them in one place and avoid duplication.

public record EditSinglePunchDto(
    string Time,        // "HH:mm"
    string? Reason
);

public record EditAttendanceDto(
    int EmployeeId,
    string Date,        // "yyyy-MM-dd"
    string? InTime,     // "HH:mm"
    string? OutTime,    // "HH:mm"
    string? Reason,
    long? PunchId1 = null,
    long? PunchId2 = null
);

public record ManualPunchDto(
    int EmployeeId,
    string PunchDate,   // "yyyy-MM-dd"
    string? InTime,     // "HH:mm"
    string? OutTime,    // "HH:mm"
    string? Reason
);

public record PunchRequestDto(
    int? EmployeeId,
    string? PunchType,
    string? Source,
    double? Latitude,
    double? Longitude,
    string? PhotoBase64,
    /// <summary>
    /// [IGNORED BY BACKEND] Retained for wire-compatibility with older app versions only.
    /// The backend independently determines liveness via server-side ONNX inference
    /// (MiniFASNetV2 + MiniFASNetV1SE fusion). The value sent by the client has no
    /// effect on the attendance decision.
    /// </summary>
    bool? LivenessVerified = null,
    /// <summary>
    /// Retained for wire-compatibility. The backend overwrites FaceConfidence in the
    /// attendance log with the server-measured ONNX cosine similarity score.
    /// </summary>
    double? FaceConfidence = null,
    /// <summary>
    /// Retained for wire-compatibility. Not used in the server-side verification pipeline.
    /// </summary>
    string? FaceId = null,
    /// <summary>
    /// [IGNORED BY BACKEND] Retained for wire-compatibility. The server does not trust
    /// on-device face matching results. The onDeviceVerified bypass has been removed.
    /// </summary>
    bool? IsFaceIdNew = null,
    /// <summary>
    /// One-time challenge token obtained from POST /api/attendance/request-challenge.
    /// Required for face attendance employees. The server validates this against
    /// server-side state — sending a fake or reused ID will be rejected.
    /// </summary>
    string? ChallengeId = null,
    /// <summary>
    /// Sequence of base64-encoded JPEG frames captured during the challenge window.
    /// Order matters: frame[0] = baseline (face forward), frame[N-1] = peak movement.
    /// The server runs YuNet on each frame to verify temporal head movement.
    /// Intermediate frames are processed in memory only — not written to disk.
    /// The last frame is used as the attendance photo.
    /// </summary>
    IReadOnlyList<string>? Frames = null
);

/// <summary>Request body for POST /api/attendance/request-challenge.</summary>
public record RequestChallengeDto(
    int? EmployeeId = null,
    string? PunchType = null
);

/// <summary>
/// Request body for POST /api/attendance/debug-face-scores.
/// Both images are base64-encoded JPEG (with or without data URI prefix).
/// Neither image is written to disk — used only for in-memory AI pipeline scoring.
/// </summary>
public record DebugFaceScoresRequestDto(
    string PunchPhotoBase64,
    string EnrolledPhotoBase64
);
