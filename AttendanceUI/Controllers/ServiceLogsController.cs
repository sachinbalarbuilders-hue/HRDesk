using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Text;

namespace AttendanceUI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ServiceLogsController : ControllerBase
    {
        private const string LogFilePath = @"C:\HRServices\Z903AttendanceService\Logs\service.log";
        private const int MaxTailLines = 500;
        private const int MaxResponseLines = 100;

        /// <summary>
        /// Returns the last N lines of the service log file.
        /// Used on initial page load.
        /// </summary>
        [HttpGet("tail")]
        public IActionResult GetTail([FromQuery] int lines = 200)
        {
            lines = Math.Clamp(lines, 1, MaxTailLines);

            if (!System.IO.File.Exists(LogFilePath))
            {
                return Ok(new LogTailResponse
                {
                    Lines = new List<string> { $"[INFO] Log file not found at: {LogFilePath}" },
                    FileOffset = 0
                });
            }

            try
            {
                using var fs = new FileStream(LogFilePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
                long fileSize = fs.Length;

                var result = ReadLastNLines(fs, lines);

                return Ok(new LogTailResponse
                {
                    Lines = result,
                    FileOffset = fileSize
                });
            }
            catch (Exception ex)
            {
                return Ok(new LogTailResponse
                {
                    Lines = new List<string> { $"[ERROR] Could not read log file: {ex.Message}" },
                    FileOffset = 0
                });
            }
        }

        /// <summary>
        /// Returns new lines written since the given byte offset.
        /// Used for real-time polling after the initial load.
        /// </summary>
        [HttpGet("since")]
        public IActionResult GetSince([FromQuery] long offset = 0)
        {
            if (!System.IO.File.Exists(LogFilePath))
            {
                return Ok(new LogSinceResponse
                {
                    Lines = new List<string>(),
                    FileOffset = 0,
                    FileExists = false
                });
            }

            try
            {
                using var fs = new FileStream(LogFilePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
                long fileSize = fs.Length;

                // File was truncated or rotated — reset
                if (offset > fileSize)
                {
                    var reset = ReadLastNLines(fs, 50);
                    return Ok(new LogSinceResponse
                    {
                        Lines = reset,
                        FileOffset = fileSize,
                        FileExists = true,
                        WasReset = true
                    });
                }

                // Nothing new
                if (offset == fileSize)
                {
                    return Ok(new LogSinceResponse
                    {
                        Lines = new List<string>(),
                        FileOffset = fileSize,
                        FileExists = true
                    });
                }

                // Read only new bytes
                fs.Seek(offset, SeekOrigin.Begin);
                var buffer = new byte[fileSize - offset];
                int bytesRead = fs.Read(buffer, 0, buffer.Length);

                if (bytesRead == 0)
                {
                    return Ok(new LogSinceResponse
                    {
                        Lines = new List<string>(),
                        FileOffset = fileSize,
                        FileExists = true
                    });
                }

                var newContent = Encoding.UTF8.GetString(buffer, 0, bytesRead);
                var newLines = newContent
                    .Split('\n')
                    .Select(l => l.TrimEnd('\r'))
                    .Where(l => !string.IsNullOrWhiteSpace(l))
                    .Take(MaxResponseLines)
                    .ToList();

                return Ok(new LogSinceResponse
                {
                    Lines = newLines,
                    FileOffset = fileSize,
                    FileExists = true
                });
            }
            catch (Exception ex)
            {
                return Ok(new LogSinceResponse
                {
                    Lines = new List<string> { $"[ERROR] {ex.Message}" },
                    FileOffset = offset,
                    FileExists = true
                });
            }
        }

        /// <summary>
        /// Streams the raw log file for download.
        /// </summary>
        [HttpGet("download")]
        public IActionResult Download()
        {
            if (!System.IO.File.Exists(LogFilePath))
                return NotFound("Log file does not exist.");

            try
            {
                // Copy to memory to avoid file lock issues during download
                byte[] fileBytes;
                using (var fs = new FileStream(LogFilePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
                using (var ms = new MemoryStream())
                {
                    fs.CopyTo(ms);
                    fileBytes = ms.ToArray();
                }

                string fileName = $"z903service_{DateTime.Now:yyyyMMdd_HHmmss}.log";
                return File(fileBytes, "text/plain", fileName);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Download failed: {ex.Message}");
            }
        }

        // ─── Helpers ───────────────────────────────────────────────────────────

        private static List<string> ReadLastNLines(FileStream fs, int lineCount)
        {
            var lines = new LinkedList<string>();
            long position = fs.Length;
            const int bufferSize = 4096;
            var sb = new StringBuilder();

            while (position > 0 && lines.Count < lineCount)
            {
                long readStart = Math.Max(0, position - bufferSize);
                int toRead = (int)(position - readStart);
                position = readStart;

                fs.Seek(readStart, SeekOrigin.Begin);
                var buffer = new byte[toRead];
                fs.Read(buffer, 0, toRead);

                // Decode and prepend to existing fragment
                string chunk = Encoding.UTF8.GetString(buffer) + sb.ToString();
                sb.Clear();

                // Walk backwards splitting on newlines
                int idx = chunk.Length - 1;
                while (idx >= 0 && lines.Count < lineCount)
                {
                    if (chunk[idx] == '\n')
                    {
                        string line = chunk.Substring(idx + 1).TrimEnd('\r');
                        if (!string.IsNullOrWhiteSpace(line))
                            lines.AddFirst(line);
                        chunk = chunk.Substring(0, idx);
                        idx = chunk.Length - 1;
                    }
                    else
                    {
                        idx--;
                    }
                }

                // Remaining fragment carries over to the next read
                if (chunk.Length > 0)
                    sb.Insert(0, chunk);
            }

            // Any remaining text is the very first line
            if (sb.Length > 0)
            {
                string firstLine = sb.ToString().TrimEnd('\r');
                if (!string.IsNullOrWhiteSpace(firstLine))
                    lines.AddFirst(firstLine);
            }

            return lines.ToList();
        }
    }

    public class LogTailResponse
    {
        public List<string> Lines { get; set; } = new();
        public long FileOffset { get; set; }
    }

    public class LogSinceResponse
    {
        public List<string> Lines { get; set; } = new();
        public long FileOffset { get; set; }
        public bool FileExists { get; set; }
        public bool WasReset { get; set; }
    }
}
