using System;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;

namespace AttendanceUI.Services.Notifications
{
    public class NodeJsWhatsAppProvider : IWhatsAppProvider
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<NodeJsWhatsAppProvider> _logger;

        public NodeJsWhatsAppProvider(HttpClient httpClient, ILogger<NodeJsWhatsAppProvider> logger)
        {
            _httpClient = httpClient;
            _logger = logger;
            // Configured in Program.cs, e.g., BaseAddress = new Uri("http://localhost:3000")
        }

        public async Task<bool> SendMessageAsync(string phoneNumber, string message)
        {
            try
            {
                var payload = new
                {
                    phone = phoneNumber,
                    message = message,
                    type = "text"
                };

                var response = await _httpClient.PostAsJsonAsync("/send", payload);
                response.EnsureSuccessStatusCode();

                _logger.LogInformation("Successfully queued WhatsApp text message to {Phone}", phoneNumber);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to queue WhatsApp text message to {Phone}", phoneNumber);
                return false;
            }
        }

        public async Task<bool> SendDocumentAsync(string phoneNumber, string message, string base64Document, string fileName, string mimeType)
        {
            try
            {
                var payload = new
                {
                    phone = phoneNumber,
                    message = base64Document, // For documents, the base64 goes into the 'message' field based on our Node.js implementation
                    type = "document",
                    filename = fileName,
                    mimetype = mimeType
                };

                var response = await _httpClient.PostAsJsonAsync("/send", payload);
                response.EnsureSuccessStatusCode();

                _logger.LogInformation("Successfully queued WhatsApp document ({FileName}) to {Phone}", fileName, phoneNumber);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to queue WhatsApp document to {Phone}", phoneNumber);
                return false;
            }
        }

        public async Task<bool> SendImageAsync(string phoneOrGroupId, byte[] imageBytes, string fileName, string mimeType, string caption = null)
        {
            try
            {
                var payload = new
                {
                    phone = phoneOrGroupId,
                    message = Convert.ToBase64String(imageBytes),
                    type = "image",
                    filename = fileName,
                    mimetype = mimeType,
                    caption = caption
                };

                var response = await _httpClient.PostAsJsonAsync("/send", payload);
                response.EnsureSuccessStatusCode();

                _logger.LogInformation("Successfully queued WhatsApp image ({FileName}) to {Phone}", fileName, phoneOrGroupId);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to queue WhatsApp image to {Phone}", phoneOrGroupId);
                return false;
            }
        }

        public async Task<bool> SendCelebrationAsync(string phoneOrGroupId, string employeeName, string eventType, string photoBase64, string caption = null, int years = 0)
        {
            try
            {
                var payload = new
                {
                    phone = phoneOrGroupId,
                    type = "celebration",
                    name = employeeName,
                    eventType = eventType,
                    photoBase64 = photoBase64,
                    caption = caption,
                    years = years
                };

                var response = await _httpClient.PostAsJsonAsync("/send", payload);
                response.EnsureSuccessStatusCode();

                _logger.LogInformation("Successfully queued WhatsApp celebration for {Employee} to {Phone}", employeeName, phoneOrGroupId);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to queue WhatsApp celebration to {Phone}", phoneOrGroupId);
                return false;
            }
        }

        public async Task<(string Status, string QrCode, int QueueLength)> GetStatusAsync()
        {
            try
            {
                var response = await _httpClient.GetAsync("/qr");
                if (response.IsSuccessStatusCode)
                {
                    var result = await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
                    var status = result.GetProperty("status").GetString();
                    
                    if (status == "qr_ready")
                    {
                        return (status, result.GetProperty("qr").GetString(), 0);
                    }
                    else if (status == "connected")
                    {
                        // Get queue length from /status
                        var statusResponse = await _httpClient.GetAsync("/status");
                        if (statusResponse.IsSuccessStatusCode)
                        {
                            var statusResult = await statusResponse.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
                            int queueLength = statusResult.GetProperty("queueLength").GetInt32();
                            return (status, string.Empty, queueLength);
                        }
                        return (status, string.Empty, 0);
                    }
                    
                    return (status, string.Empty, 0);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get WhatsApp status");
            }
            return ("disconnected", string.Empty, 0);
        }
    }
}
