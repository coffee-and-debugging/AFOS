using System;
using System.IO;
using Avalonia.Controls;
using Avalonia.Interactivity;
using Avalonia.Media.Imaging;
using Avalonia.Platform.Storage;
using AFOS.Desktop.Database;
using AFOS.Desktop.Helpers;
using AFOS.Desktop.Models;
using QRCoder;

namespace AFOS.Desktop.Views.Dialogs;

public partial class QrCodeDialog : Window
{
    private readonly Table _table;
    private byte[]? _pngBytes;

    public QrCodeDialog() { InitializeComponent(); _table = new Table(); }

    public QrCodeDialog(Table table) : this()
    {
        _table = table;
        TxtTitle.Text = $"Table #{table.Number} — QR Code";
        GenerateQr();
    }

    private async void GenerateQr()
    {
        // Guests' phones can't open localhost: use the configured or detected network address
        string configured;
        try { configured = await DatabaseService.Instance.GetQrBaseUrlAsync(); }
        catch (Exception) { configured = ""; }
        var url = $"{NetworkHelper.GuestBaseUrl(configured)}/table/{_table.Id}/";
        TxtUrl.Text = url;

        using var qrGen   = new QRCodeGenerator();
        var qrData        = qrGen.CreateQrCode(url, QRCodeGenerator.ECCLevel.M);
        var pngByteQrCode = new PngByteQRCode(qrData);
        _pngBytes         = pngByteQrCode.GetGraphic(8);

        var bmp = new Bitmap(new MemoryStream(_pngBytes));
        QrImage.Source = bmp;
    }

    private async void BtnDownload_Click(object? sender, RoutedEventArgs e)
    {
        if (_pngBytes == null) return;

        var topLevel = TopLevel.GetTopLevel(this);
        if (topLevel == null) return;

        var file = await topLevel.StorageProvider.SaveFilePickerAsync(new FilePickerSaveOptions
        {
            Title = "Save QR Code",
            SuggestedFileName = $"table-{_table.Number}-qr.png",
            FileTypeChoices = new[]
            {
                new FilePickerFileType("PNG Image") { Patterns = new[] { "*.png" } }
            }
        });

        if (file != null)
        {
            await using var stream = await file.OpenWriteAsync();
            await stream.WriteAsync(_pngBytes);
        }
    }

    private void BtnClose_Click(object? sender, RoutedEventArgs e) => Close();
}
