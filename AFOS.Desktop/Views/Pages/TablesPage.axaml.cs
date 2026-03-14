using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Interactivity;
using AFOS.Desktop.Models;
using AFOS.Desktop.ViewModels;
using AFOS.Desktop.Views.Dialogs;

namespace AFOS.Desktop.Views.Pages;

public partial class TablesPage : UserControl
{
    private readonly TablesViewModel _vm;

    public TablesPage()
    {
        InitializeComponent();
        _vm = new TablesViewModel();
        DataContext = _vm;
        Loaded += async (_, _) => await _vm.LoadAsync();
    }

    public async void Reload() => await _vm.LoadAsync();

    private async void BtnAddTable_Click(object? sender, RoutedEventArgs e)
    {
        await DoAddTableAsync();
    }

    private async void TxtTableNumber_KeyDown(object? sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter)
        {
            await DoAddTableAsync();
        }
    }

    private async Task DoAddTableAsync()
    {
        TxtAddError.IsVisible = false;

        var (ok, msg) = await _vm.AddTableAsync();
        if (!ok)
        {
            TxtAddError.Text = msg;
            TxtAddError.IsVisible = true;
        }
    }

    private async void BtnQr_Click(object? sender, RoutedEventArgs e)
    {
        if (sender is not Button btn || btn.Tag is not Table table) return;

        var dlg = new QrCodeDialog(table);
        await dlg.ShowDialog(TopLevel.GetTopLevel(this) as Window ?? throw new InvalidOperationException());
    }

    private async void BtnRemove_Click(object? sender, RoutedEventArgs e)
    {
        if (sender is not Button btn || btn.Tag is not Table table) return;
        await _vm.DeleteTableAsync(table);
    }
}
