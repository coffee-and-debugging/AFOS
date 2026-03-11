using System.Collections.ObjectModel;
using AFOS.Desktop.Database;
using AFOS.Desktop.Models;

namespace AFOS.Desktop.ViewModels;

public class TablesViewModel : BaseViewModel
{
    private bool _isLoading;
    private string _statusMessage = "";
    private string _newTableNumber = "";

    public bool IsLoading       { get => _isLoading;       set => SetField(ref _isLoading, value); }
    public string StatusMessage { get => _statusMessage;   set => SetField(ref _statusMessage, value); }
    public string NewTableNumber{ get => _newTableNumber;  set => SetField(ref _newTableNumber, value); }

    public ObservableCollection<Table> Tables { get; } = new();

    public async Task LoadAsync()
    {
        IsLoading = true;
        StatusMessage = "";
        try
        {
            var tables = await DatabaseService.Instance.GetTablesAsync();
            Tables.Clear();
            foreach (var t in tables) Tables.Add(t);
        }
        catch (Exception ex) { StatusMessage = $"Error loading tables: {ex.Message}"; }
        finally { IsLoading = false; }
    }

    public async Task<(bool ok, string msg)> AddTableAsync()
    {
        if (!int.TryParse(NewTableNumber.Trim(), out int num) || num <= 0)
            return (false, "Please enter a valid table number.");

        try
        {
            var table = await DatabaseService.Instance.CreateTableAsync(num);
            if (table == null) return (false, $"Table {num} already exists.");
            NewTableNumber = "";
            await LoadAsync();
            return (true, "");
        }
        catch (Exception ex) { return (false, $"Error: {ex.Message}"); }
    }

    public async Task<bool> DeleteTableAsync(Table table)
    {
        try
        {
            var ok = await DatabaseService.Instance.DeleteTableAsync(table.Id);
            if (ok) await LoadAsync();
            return ok;
        }
        catch { return false; }
    }
}
