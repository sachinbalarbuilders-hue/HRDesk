using System;
using System.Collections.Generic;
using System.Configuration;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json;

namespace Z903AttendanceService
{
    public class PendingCommandDto
    {
        public int Id { get; set; }
        public string Action { get; set; }
        public int? EmployeeId { get; set; }
        public string EmployeeName { get; set; }
        public bool? Enabled { get; set; }
    }

    public class ApiClient
    {
        private readonly HttpClient _httpClient;
        private readonly Action<string> _logger;
        private readonly string _baseUrl;

        public ApiClient(Action<string> logger)
        {
            _logger = logger;
            _baseUrl = ConfigurationManager.AppSettings["CloudApiBaseUrl"];
            string apiKey = ConfigurationManager.AppSettings["CloudApiKey"];

            if (string.IsNullOrWhiteSpace(_baseUrl) || string.IsNullOrWhiteSpace(apiKey))
            {
                throw new InvalidOperationException("Cloud API configuration is missing in App.config.");
            }

            _httpClient = new HttpClient();
            _httpClient.DefaultRequestHeaders.Add("X-Api-Key", apiKey);
        }

        private void Log(string msg) => _logger?.Invoke($"[ApiClient] {msg}");

        public async Task<DeviceConfigDto> GetConfigAsync()
        {
            var response = await _httpClient.GetAsync($"{_baseUrl}/config");
            response.EnsureSuccessStatusCode();
            var json = await response.Content.ReadAsStringAsync();
            return JsonConvert.DeserializeObject<DeviceConfigDto>(json);
        }

        public async Task<List<PendingCommandDto>> GetPendingCommandsAsync()
        {
            var response = await _httpClient.GetAsync($"{_baseUrl}/commands/pending");
            response.EnsureSuccessStatusCode();
            var json = await response.Content.ReadAsStringAsync();
            return JsonConvert.DeserializeObject<List<PendingCommandDto>>(json) ?? new List<PendingCommandDto>();
        }

        public async Task UpdateCommandResultAsync(int id, bool success, string errorMessage = null)
        {
            var payload = new { Success = success, ErrorMessage = errorMessage };
            var content = new StringContent(JsonConvert.SerializeObject(payload), Encoding.UTF8, "application/json");
            var response = await _httpClient.PostAsync($"{_baseUrl}/commands/{id}/result", content);
            response.EnsureSuccessStatusCode();
        }

        public async Task<bool> PushLogsAsync(List<AttendanceRecord> logs)
        {
            if (logs == null || logs.Count == 0) return true;

            var content = new StringContent(JsonConvert.SerializeObject(logs), Encoding.UTF8, "application/json");
            var response = await _httpClient.PostAsync($"{_baseUrl}/logs", content);
            
            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                Log($"Failed to push logs: {response.StatusCode} - {error}");
                return false;
            }
            return true;
        }
    }
}
