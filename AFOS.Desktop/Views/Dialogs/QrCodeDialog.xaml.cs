using System.IO;
using System.Windows;
using System.Windows.Media.Imaging;
using Microsoft.Win32;
using AFOS.Desktop.Models;
using QRCoder;

namespace AFOS.Desktop.Views.Dialogs;

public partial class QrCodeDialog : Window
{
    private readonly Table _table;
    private byte[]? _pngBytes;

    public QrCodeDialog(Table table)
    {
        InitializeComponent();
        _table = table;
        TxtTitle.Text = $"Table #{table.Number} — QR Code";
        GenerateQr();
    }

    private void GenerateQr()
    {
        // Build URL pointing to the web customer page
        var url = $"http://localhost:5173/table/{_table.Id}";
        TxtUrl.Text = url;

        using var qrGen    = new QRCodeGenerator();
        var qrData         = qrGen.CreateQrCode(url, QRCodeGenerator.ECCLevel.M);
        var pngByteQrCode  = new PngByteQRCode(qrData);
        _pngBytes          = pngByteQrCode.GetGraphic(8); // 8px per module

        var bmp = new BitmapImage();
        bmp.BeginInit();
        bmp.StreamSource    = new MemoryStream(_pngBytes);
        bmp.CacheOption     = BitmapCacheOption.OnLoad;
        bmp.EndInit();
        bmp.Freeze();
        QrImage.Source = bmp;
    }

    private void BtnDownload_Click(object sender, RoutedEventArgs e)
    {
        if (_pngBytes == null) return;
        var dlg = new SaveFileDialog
        {
            FileName   = $"table-{_table.Number}-qr",
            DefaultExt = ".png",
            Filter     = "PNG Image|*.png"
        };
        if (dlg.ShowDialog() == true)
            File.WriteAllBytes(dlg.FileName, _pngBytes);
    }

    private void BtnClose_Click(object sender, RoutedEventArgs e) => Close();
}
