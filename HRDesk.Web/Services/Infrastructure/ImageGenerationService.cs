using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using SixLabors.Fonts;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Drawing.Processing;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;
using SixLabors.ImageSharp.Drawing;

namespace HRDesk.Web.Services
{
    public class ImageGenerationService
    {
        private readonly IConfiguration _configuration;

        public ImageGenerationService(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        public async Task<byte[]> GenerateCelebrationPosterAsync(string employeeName, string eventType, byte[]? photoBytes)
        {
            var baseDir = AppContext.BaseDirectory;
            var assetsDir = System.IO.Path.Combine(baseDir, "Assets");
            
            if (!Directory.Exists(assetsDir))
            {
                Directory.CreateDirectory(assetsDir);
            }

            // Path to the base template image
            var templateFileName = eventType.Equals("Birthday", StringComparison.OrdinalIgnoreCase) 
                ? "birthday_template.jpg" 
                : "anniversary_template.jpg";
                
            var templatePath = System.IO.Path.Combine(assetsDir, templateFileName);
            
            // If template doesn't exist, create a fallback generated background
            if (!File.Exists(templatePath))
            {
                CreateFallbackTemplate(templatePath, eventType);
            }

            // Path to the font
            var fontPath = System.IO.Path.Combine(assetsDir, "OpenSans-Bold.ttf");
            if (!File.Exists(fontPath))
            {
                // Download a standard font or throw - for now we just fallback to SystemFonts if available
            }

            FontCollection collection = new();
            FontFamily family;
            try
            {
                family = collection.Add(fontPath);
            }
            catch 
            {
                family = SystemFonts.Families.FirstOrDefault();
            }
            var font = family.CreateFont(72, FontStyle.Bold);

            // Load the template
            using var image = Image.Load(templatePath);
            
            // Prepare the photo
            if (photoBytes != null && photoBytes.Length > 0)
            {
                try
                {
                    using var photoMs = new MemoryStream(photoBytes);
                    using var photo = Image.Load(photoMs);
                    
                    // Resize to a square first
                    photo.Mutate(x => x.Resize(new ResizeOptions
                    {
                        Size = new Size(300, 300),
                        Mode = ResizeMode.Crop
                    }));

                    // Create a circle avatar
                    using var roundAvatar = new Image<Rgba32>(300, 300);
                    roundAvatar.Mutate(x => {
                        var brush = new ImageBrush(photo);
                        var circle = new EllipsePolygon(150, 150, 150);
                        x.Fill(brush, circle);
                        
                        // Add a gold/white border depending on event type
                        var borderColor = eventType.Equals("Birthday", StringComparison.OrdinalIgnoreCase) 
                            ? Color.White 
                            : Color.Gold;
                        x.Draw(borderColor, 6f, circle);
                    });

                    // Overlay the photo in the center, slightly higher up
                    image.Mutate(x => x.DrawImage(roundAvatar, new Point(400, 150), 1f));
                }
                catch
                {
                    // If image load fails, skip drawing photo
                }
            }

            // Draw the employee's name with drop shadow
            var nameFont = family.CreateFont(90, FontStyle.Bold); // Larger font
            var textOptions = new TextOptions(nameFont)
            {
                Origin = new PointF(image.Width / 2f, 520),
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center
            };
            
            var textColor = eventType.Equals("Birthday", StringComparison.OrdinalIgnoreCase) 
                ? Color.White 
                : Color.Gold;

            // Drop shadow for name
            var shadowOptions = new TextOptions(nameFont)
            {
                Origin = new PointF(image.Width / 2f + 4, 524),
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center
            };
            image.Mutate(x => x.DrawText(shadowOptions, employeeName, Color.Black.WithAlpha(0.7f)));
            image.Mutate(x => x.DrawText(textOptions, employeeName, textColor));

            // Draw the event text with drop shadow
            var subFont = family.CreateFont(65, FontStyle.Bold); // Larger font
            var subTextOptions = new TextOptions(subFont)
            {
                Origin = new PointF(image.Width / 2f, 650),
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center
            };
            var subShadowOptions = new TextOptions(subFont)
            {
                Origin = new PointF(image.Width / 2f + 3, 653),
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center
            };

            var eventMessage = eventType.Equals("Birthday", StringComparison.OrdinalIgnoreCase)
                ? "Happy Birthday!"
                : "Happy Work Anniversary!";
                
            image.Mutate(x => x.DrawText(subShadowOptions, eventMessage, Color.Black.WithAlpha(0.7f)));
            image.Mutate(x => x.DrawText(subTextOptions, eventMessage, textColor));

            // Return as byte array
            using var ms = new MemoryStream();
            await image.SaveAsJpegAsync(ms);
            return ms.ToArray();
        }

        private void CreateFallbackTemplate(string path, string eventType)
        {
            using var image = new Image<Rgba32>(1100, 900);
            
            var bgColor = eventType.Equals("Birthday", StringComparison.OrdinalIgnoreCase)
                ? Color.Indigo
                : Color.DarkBlue;
                
            image.Mutate(x => x.Fill(bgColor));
            image.Save(path);
        }
    }
}
