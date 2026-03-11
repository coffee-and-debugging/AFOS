using System.Windows;
using System.Windows.Controls;

namespace AFOS.Desktop.Views.Dialogs;

public partial class MenuItemDialog : Window
{
    private readonly Models.MenuItem? _editItem;
    public Models.MenuItem? ResultItem { get; private set; }

    public MenuItemDialog(Models.MenuItem? item)
    {
        InitializeComponent();
        _editItem = item;

        if (item != null)
        {
            TxtTitle.Text       = "Edit Menu Item";
            TxtName.Text        = item.Name;
            TxtDescription.Text = item.Description;
            TxtPrice.Text       = item.Price.ToString("0.00");
            ChkAvailable.IsChecked = item.Available;

            // Select category
            foreach (ComboBoxItem ci in CmbCategory.Items)
                if (ci.Tag?.ToString() == item.Category)
                {
                    CmbCategory.SelectedItem = ci;
                    break;
                }
        }
        else
        {
            CmbCategory.SelectedIndex = 0;
        }
    }

    private void BtnSave_Click(object sender, RoutedEventArgs e)
    {
        TxtError.Visibility = Visibility.Collapsed;

        var name = TxtName.Text.Trim();
        var desc = TxtDescription.Text.Trim();
        var priceStr = TxtPrice.Text.Trim();

        if (string.IsNullOrEmpty(name))
        {
            ShowError("Name is required.");
            return;
        }

        if (!decimal.TryParse(priceStr, out decimal price) || price <= 0)
        {
            ShowError("Please enter a valid price.");
            return;
        }

        var selectedCat = (CmbCategory.SelectedItem as ComboBoxItem)?.Tag?.ToString() ?? "tea";

        ResultItem = new Models.MenuItem
        {
            Id          = _editItem?.Id ?? 0,
            Name        = name,
            Description = desc,
            Price       = price,
            Category    = selectedCat,
            Available   = ChkAvailable.IsChecked ?? true,
            ImageUrl    = _editItem?.ImageUrl
        };

        DialogResult = true;
        Close();
    }

    private void BtnCancel_Click(object sender, RoutedEventArgs e)
    {
        DialogResult = false;
        Close();
    }

    private void ShowError(string msg)
    {
        TxtError.Text       = msg;
        TxtError.Visibility = Visibility.Visible;
    }
}
