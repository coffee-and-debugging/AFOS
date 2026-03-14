using Avalonia.Controls;
using Avalonia.Interactivity;
using AFOS.Desktop.ViewModels;
using AFOS.Desktop.Views.Dialogs;

namespace AFOS.Desktop.Views.Pages;

public partial class MenuPage : UserControl
{
    private readonly MenuViewModel _vm;

    public MenuPage()
    {
        InitializeComponent();
        _vm = new MenuViewModel();
        DataContext = _vm;
        Loaded += async (_, _) => await _vm.LoadAsync();
    }

    public async void Reload() => await _vm.LoadAsync();

    private async void BtnAddItem_Click(object? sender, RoutedEventArgs e)
    {
        var dlg = new MenuItemDialog(null);
        var result = await dlg.ShowDialog<bool>(TopLevel.GetTopLevel(this) as Window ?? throw new InvalidOperationException());
        if (result)
        {
            await _vm.SaveItemAsync(dlg.ResultItem, true);
        }
    }

    private async void BtnEdit_Click(object? sender, RoutedEventArgs e)
    {
        if (sender is not Button btn || btn.Tag is not Models.MenuItem item) return;

        var dlg = new MenuItemDialog(item);
        var result = await dlg.ShowDialog<bool>(TopLevel.GetTopLevel(this) as Window ?? throw new InvalidOperationException());
        if (result)
        {
            await _vm.SaveItemAsync(dlg.ResultItem, false);
        }
    }

    private async void BtnToggle_Click(object? sender, RoutedEventArgs e)
    {
        if (sender is not Button btn || btn.Tag is not Models.MenuItem item) return;
        await _vm.ToggleAvailabilityAsync(item);
    }

    private async void BtnDelete_Click(object? sender, RoutedEventArgs e)
    {
        if (sender is not Button btn || btn.Tag is not Models.MenuItem item) return;
        await _vm.DeleteItemAsync(item.Id);
    }
}
