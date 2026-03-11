using System.Windows;
using System.Windows.Controls;
using AFOS.Desktop.ViewModels;
using AFOS.Desktop.Views.Dialogs;

namespace AFOS.Desktop.Views.Pages;

public partial class MenuPage : UserControl
{
    private readonly MenuViewModel _vm = new();

    public MenuPage()
    {
        InitializeComponent();
        DataContext = _vm;
        Loaded += async (_, _) => await _vm.LoadAsync();
    }

    public void Reload() => _ = _vm.LoadAsync();

    private void BtnAddItem_Click(object sender, RoutedEventArgs e)
    {
        var dlg = new MenuItemDialog(null) { Owner = Window.GetWindow(this) };
        if (dlg.ShowDialog() == true && dlg.ResultItem != null)
            _ = _vm.SaveItemAsync(dlg.ResultItem, isNew: true);
    }

    private void BtnEdit_Click(object sender, RoutedEventArgs e)
    {
        if (sender is Button btn && btn.Tag is Models.MenuItem item)
        {
            var dlg = new MenuItemDialog(item) { Owner = Window.GetWindow(this) };
            if (dlg.ShowDialog() == true && dlg.ResultItem != null)
                _ = _vm.SaveItemAsync(dlg.ResultItem, isNew: false);
        }
    }

    private async void BtnToggle_Click(object sender, RoutedEventArgs e)
    {
        if (sender is Button btn && btn.Tag is Models.MenuItem item)
            await _vm.ToggleAvailabilityAsync(item);
    }

    private async void BtnDelete_Click(object sender, RoutedEventArgs e)
    {
        if (sender is Button btn && btn.Tag is Models.MenuItem item)
        {
            var res = MessageBox.Show(
                $"Delete \"{item.Name}\"? This cannot be undone.",
                "Confirm Delete", MessageBoxButton.YesNo, MessageBoxImage.Warning);
            if (res == MessageBoxResult.Yes)
                await _vm.DeleteItemAsync(item.Id);
        }
    }
}
