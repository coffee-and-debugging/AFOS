using AFOS.Desktop.Database;
using AFOS.Desktop.Helpers;

namespace AFOS.Desktop.ViewModels;

public class LoginViewModel : BaseViewModel
{
    private string _username = "";
    private string _errorMessage = "";
    private bool _isLoading;

    public string Username
    {
        get => _username;
        set => SetField(ref _username, value);
    }

    public string ErrorMessage
    {
        get => _errorMessage;
        set => SetField(ref _errorMessage, value);
    }

    public bool IsLoading
    {
        get => _isLoading;
        set => SetField(ref _isLoading, value);
    }

    public bool HasError     => !string.IsNullOrEmpty(ErrorMessage);
    public bool IsNotLoading => !_isLoading;

    public async Task<string?> LoginAsync(string password)
    {
        if (string.IsNullOrWhiteSpace(Username) || string.IsNullOrWhiteSpace(password))
        {
            ErrorMessage = "Please enter username and password.";
            OnPropertyChanged(nameof(HasError));
            return null;
        }

        IsLoading = true;
        OnPropertyChanged(nameof(IsNotLoading));
        ErrorMessage = "";
        OnPropertyChanged(nameof(HasError));

        try
        {
            var user = await DatabaseService.Instance.AuthenticateAsync(Username.Trim(), password);
            if (user == null)
            {
                ErrorMessage = "Invalid username or password.";
                OnPropertyChanged(nameof(HasError));
                return null;
            }

            AppState.CurrentUser = user;
            return user.Role; // "admin" or "chef"
        }
        catch (Exception ex)
        {
            ErrorMessage = $"Connection error: {ex.Message}";
            OnPropertyChanged(nameof(HasError));
            return null;
        }
        finally
        {
            IsLoading = false;
            OnPropertyChanged(nameof(IsNotLoading));
        }
    }
}
