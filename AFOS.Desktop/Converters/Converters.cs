using System.Globalization;
using System.Windows;
using System.Windows.Data;
using System.Windows.Media;

namespace AFOS.Desktop.Converters;

// True → Visible, False → Collapsed
public class BoolToVisibilityConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        => value is bool b && b ? Visibility.Visible : Visibility.Collapsed;
    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        => value is Visibility v && v == Visibility.Visible;
}

// True → Collapsed, False → Visible
public class InverseBoolToVisibilityConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        => value is bool b && b ? Visibility.Collapsed : Visibility.Visible;
    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        => value is Visibility v && v == Visibility.Collapsed;
}

// null → Collapsed, non-null → Visible
public class NullToVisibilityConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        => value == null || (value is string s && string.IsNullOrWhiteSpace(s))
            ? Visibility.Collapsed : Visibility.Visible;
    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        => throw new NotImplementedException();
}

// Status string → background brush
public class StatusToBrushConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        var hex = value?.ToString() switch
        {
            "pending"   => "#fff3cd",
            "cooking"   => "#cff4fc",
            "serving"   => "#d1e7dd",
            "completed" => "#e2e3e5",
            _           => "#e2e3e5"
        };
        return new SolidColorBrush((Color)ColorConverter.ConvertFromString(hex));
    }
    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        => throw new NotImplementedException();
}

// Status string → foreground brush
public class StatusToFgConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        var hex = value?.ToString() switch
        {
            "pending"   => "#856404",
            "cooking"   => "#055160",
            "serving"   => "#0a3622",
            "completed" => "#41464b",
            _           => "#41464b"
        };
        return new SolidColorBrush((Color)ColorConverter.ConvertFromString(hex));
    }
    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        => throw new NotImplementedException();
}

// Payment status → background brush
public class PayStatusToBrushConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        var hex = value?.ToString() switch
        {
            "paid"            => "#d1e7dd",
            "pending_counter" => "#fff3cd",
            "unpaid"          => "#f8d7da",
            _                 => "#e2e3e5"
        };
        return new SolidColorBrush((Color)ColorConverter.ConvertFromString(hex));
    }
    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        => throw new NotImplementedException();
}

// Payment status → foreground brush
public class PayStatusToFgConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        var hex = value?.ToString() switch
        {
            "paid"            => "#0a3622",
            "pending_counter" => "#856404",
            "unpaid"          => "#842029",
            _                 => "#41464b"
        };
        return new SolidColorBrush((Color)ColorConverter.ConvertFromString(hex));
    }
    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        => throw new NotImplementedException();
}

// Left border color for chef order card
public class StatusToBorderBrushConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        var hex = value?.ToString() switch
        {
            "pending"   => "#fd7e14",
            "cooking"   => "#0dcaf0",
            "serving"   => "#2d6a4f",
            "completed" => "#adb5bd",
            _           => "#dee2e6"
        };
        return new SolidColorBrush((Color)ColorConverter.ConvertFromString(hex));
    }
    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        => throw new NotImplementedException();
}

// bool available → text
public class AvailableToTextConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        => value is bool b && b ? "Available" : "Unavailable";
    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        => throw new NotImplementedException();
}

// bool available → foreground brush
public class AvailableToFgConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        if (value is bool b && b)
            return new SolidColorBrush((Color)ColorConverter.ConvertFromString("#0a3622"));
        return new SolidColorBrush((Color)ColorConverter.ConvertFromString("#842029"));
    }
    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        => throw new NotImplementedException();
}

// bool available → background brush
public class AvailableToBgConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        if (value is bool b && b)
            return new SolidColorBrush((Color)ColorConverter.ConvertFromString("#d1e7dd"));
        return new SolidColorBrush((Color)ColorConverter.ConvertFromString("#f8d7da"));
    }
    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        => throw new NotImplementedException();
}

// string equal → bool (for tab active state)
public class StringEqualToBoolConverter : IMultiValueConverter
{
    public object Convert(object[] values, Type targetType, object parameter, CultureInfo culture)
        => values.Length >= 2 && values[0]?.ToString() == values[1]?.ToString();
    public object[] ConvertBack(object value, Type[] targetTypes, object parameter, CultureInfo culture)
        => throw new NotImplementedException();
}
