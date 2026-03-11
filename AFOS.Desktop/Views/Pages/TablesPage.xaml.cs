using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using AFOS.Desktop.Models;
using AFOS.Desktop.ViewModels;
using AFOS.Desktop.Views.Dialogs;

namespace AFOS.Desktop.Views.Pages;

public partial class TablesPage : UserControl
{
    private readonly TablesViewModel _vm = new();

    public TablesPage()
    {
        InitializeComponent();
        DataContext = _vm;
        Loaded += async (_, _) => await _vm.LoadAsync();
    }

    public void Reload() => _ = _vm.LoadAsync();

    private async void BtnAddTable_Click(object sender, RoutedEventArgs e)
        => await DoAddTableAsync();

    private async void TxtTableNumber_KeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter) await DoAddTableAsync();
    }

    private async Task DoAddTableAsync()
    {
        TxtAddError.Visibility = Visibility.Collapsed;
        var (ok, msg) = await _vm.AddTableAsync();
        if (!ok)
        {
            TxtAddError.Text       = msg;
            TxtAddError.Visibility = Visibility.Visible;
        }
    }

    private void BtnQr_Click(object sender, RoutedEventArgs e)
    {
        if (sender is Button btn && btn.Tag is Table table)
        {
            var dlg = new QrCodeDialog(table) { Owner = Window.GetWindow(this) };
            dlg.ShowDialog();
        }
    }

    private async void BtnRemove_Click(object sender, RoutedEventArgs e)
    {
        if (sender is Button btn && btn.Tag is Table table)
        {
            var res = MessageBox.Show(
                $"Remove Table #{table.Number}? All associated orders will remain in the database.",
                "Confirm Remove", MessageBoxButton.YesNo, MessageBoxImage.Warning);
            if (res == MessageBoxResult.Yes)
                await _vm.DeleteTableAsync(table);
        }
    }
}
