using System.Text.Json;
using SmartX.Api.Models;

namespace SmartX.Api.Services;

public sealed class AttachmentStore
{
    public const long MaxFileBytes = 5 * 1024 * 1024;
    private readonly SemaphoreSlim gate = new(1, 1);
    private readonly string directory;
    private readonly string indexFile;
    private readonly int maximum;
    private List<AttachmentInfo> items;
    private static readonly HashSet<string> Allowed = new(StringComparer.OrdinalIgnoreCase)
        { ".txt", ".log", ".json", ".csv", ".xml", ".pdf", ".png", ".jpg", ".jpeg" };

    public AttachmentStore(IWebHostEnvironment env, IConfiguration config)
    {
        directory = Path.Combine(env.ContentRootPath, "App_Data", "uploads");
        Directory.CreateDirectory(directory);
        indexFile = Path.Combine(directory, "index.json");
        maximum = Math.Clamp(config.GetValue("Gateway:MaxAttachmentsPerSensor", 20), 1, 100);
        items = File.Exists(indexFile)
            ? JsonSerializer.Deserialize<List<AttachmentInfo>>(File.ReadAllText(indexFile)) ?? [] : [];
    }
    public async Task<AttachmentInfo[]> List(Guid sensorId)
    {
        await gate.WaitAsync();
        try { return items.Where(x => x.SensorId == sensorId).ToArray(); }
        finally { gate.Release(); }
    }
    public async Task<AttachmentInfo> Add(Guid sensorId, IFormFile file, CancellationToken ct)
    {
        var name = Path.GetFileName(file.FileName.Replace('\\', '/'));
        if (string.IsNullOrWhiteSpace(name) || name.Length > 150 || name.Any(char.IsControl)
            || !Allowed.Contains(Path.GetExtension(name)))
            throw new GatewayException(400, "Allowed files: TXT, LOG, JSON, CSV, XML, PDF, PNG, JPG. Maximum name length: 150.");
        if (file.Length is <= 0 or > MaxFileBytes)
            throw new GatewayException(400, "Upload a non-empty file of at most 5 MiB.");
        await gate.WaitAsync(ct);
        string? savedPath = null;
        try
        {
            if (items.Count(x => x.SensorId == sensorId) >= maximum)
                throw new GatewayException(409, "Attachment limit reached for this sensor.");
            var info = new AttachmentInfo(Guid.NewGuid(), sensorId, name,
                Guid.NewGuid().ToString("N") + ".bin", file.Length, DateTimeOffset.UtcNow);
            savedPath = Path.Combine(directory, info.StoredName);
            await using (var target = new FileStream(savedPath, FileMode.CreateNew, FileAccess.Write,
                FileShare.None, 65536, FileOptions.Asynchronous))
            {
                await file.CopyToAsync(target, ct);
            }
            var updated = new List<AttachmentInfo>(items) { info };
            await File.WriteAllTextAsync(indexFile + ".tmp", JsonSerializer.Serialize(updated), ct);
            File.Move(indexFile + ".tmp", indexFile, true);
            items = updated;
            return info;
        }
        catch { if (savedPath is not null) File.Delete(savedPath); throw; }
        finally { gate.Release(); }
    }
    public async Task<(string Path, string Name)> Download(Guid sensorId, Guid attachmentId)
    {
        await gate.WaitAsync();
        try
        {
            var item = items.FirstOrDefault(x => x.SensorId == sensorId && x.Id == attachmentId)
                ?? throw new GatewayException(404, "Attachment not found for this sensor.");
            var path = Path.Combine(directory, item.StoredName);
            if (!File.Exists(path)) throw new GatewayException(404, "Attachment file is missing.");
            return (path, item.FileName);
        }
        finally { gate.Release(); }
    }
}
