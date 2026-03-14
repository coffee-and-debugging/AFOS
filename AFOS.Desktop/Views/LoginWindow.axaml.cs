using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Interactivity;
using AFOS.Desktop.ViewModels;

namespace AFOS.Desktop.Views;

public partial class LoginWindow : Window
{
    private readonly LoginViewModel _vm = new();

    public LoginWindow()
    {
        InitializeComponent();
        DataContext = _vm;
        TxtUsername.Focus();
    }

    private async void BtnLogin_Click(object? sender, RoutedEventArgs e)
        => await DoLoginAsync();

    private async void Input_KeyDown(object? sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter) await DoLoginAsync();
    }

    private async Task DoLoginAsync()
    {
        var role = await _vm.LoginAsync(TxtPassword.Text ?? "");
        if (role == null) return;

        Window next = role == "admin"
            ? new AdminWindow()
            : new ChefWindow();

        next.Show();
        Close();
    }
}
