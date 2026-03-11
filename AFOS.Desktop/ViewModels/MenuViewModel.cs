using System.Collections.ObjectModel;
using AFOS.Desktop.Database;
using AFOS.Desktop.Models;

namespace AFOS.Desktop.ViewModels;

public class MenuViewModel : BaseViewModel
{
    private bool _isLoading;
    private string _statusMessage = "";

    public bool IsLoading         { get => _isLoading;      set => SetField(ref _isLoading, value); }
    public string StatusMessage   { get => _statusMessage;  set => SetField(ref _statusMessage, value); }

    public ObservableCollection<Models.MenuItem> TeaItems  { get; } = new();
    public ObservableCollection<Models.MenuItem> FoodItems { get; } = new();

    public async Task LoadAsync()
    {
        IsLoading = true;
        StatusMessage = "";
        try
        {
            var items = await DatabaseService.Instance.GetMenuItemsAsync();
            TeaItems.Clear();
            FoodItems.Clear();
            foreach (var item in items)
            {
                if (item.Category == "tea") TeaItems.Add(item);
                else FoodItems.Add(item);
            }
        }
        catch (Exception ex) { StatusMessage = $"Error loading menu: {ex.Message}"; }
        finally { IsLoading = false; }
    }

    public async Task<bool> SaveItemAsync(Models.MenuItem item, bool isNew)
    {
        try
        {
            if (isNew)
            {
                var created = await DatabaseService.Instance.CreateMenuItemAsync(item);
                if (created == null) return false;
            }
            else
            {
                var ok = await DatabaseService.Instance.UpdateMenuItemAsync(item);
                if (!ok) return false;
            }
            await LoadAsync();
            return true;
        }
        catch (Exception ex) { StatusMessage = $"Error saving: {ex.Message}"; return false; }
    }

    public async Task<bool> ToggleAvailabilityAsync(Models.MenuItem item)
    {
        try
        {
            var newVal = !item.Available;
            var ok = await DatabaseService.Instance.ToggleMenuItemAvailabilityAsync(item.Id, newVal);
            if (ok) await LoadAsync();
            return ok;
        }
        catch (Exception ex) { StatusMessage = $"Error: {ex.Message}"; return false; }
    }

    public async Task<bool> DeleteItemAsync(int id)
    {
        try
        {
            var ok = await DatabaseService.Instance.DeleteMenuItemAsync(id);
            if (ok) await LoadAsync();
            return ok;
        }
        catch (Exception ex) { StatusMessage = $"Error deleting: {ex.Message}"; return false; }
    }
}
