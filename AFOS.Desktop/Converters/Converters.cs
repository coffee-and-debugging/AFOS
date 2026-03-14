using System.Globalization;
using Avalonia.Data.Converters;
using Avalonia.Media;

namespace AFOS.Desktop.Converters;

public class BoolToIsVisibleConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        => value is bool b && b;
    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => value is bool b && b;
}

public class InverseBoolConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        => value is bool b && !b;
    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => value is bool b && !b;
}

public class NullToIsVisibleConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        => value != null && !(value is string s && string.IsNullOrWhiteSpace(s));
    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => throw new NotImplementedException();
}

public class StatusToBrushConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        var hex = value?.ToString() switch { "pending"=>"#fff3cd", "cooking"=>"#cff4fc", "serving"=>"#d1e7dd", "completed"=>"#e2e3e5", _=>"#e2e3e5" };
        return new SolidColorBrush(Color.Parse(hex));
    }
    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture) => throw new NotImplementedException();
}

public class StatusToFgConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        var hex = value?.ToString() switch { "pending"=>"#856404", "cooking"=>"#055160", "serving"=>"#0a3622", "completed"=>"#41464b", _=>"#41464b" };
        return new SolidColorBrush(Color.Parse(hex));
    }
    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture) => throw new NotImplementedException();
}

public class PayStatusToBrushConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        var hex = value?.ToString() switch { "paid"=>"#d1e7dd", "pending_counter"=>"#fff3cd", "unpaid"=>"#f8d7da", _=>"#e2e3e5" };
        return new SolidColorBrush(Color.Parse(hex));
    }
    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture) => throw new NotImplementedException();
}

public class PayStatusToFgConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        var hex = value?.ToString() switch { "paid"=>"#0a3622", "pending_counter"=>"#856404", "unpaid"=>"#842029", _=>"#41464b" };
        return new SolidColorBrush(Color.Parse(hex));
    }
    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture) => throw new NotImplementedException();
}

public class StatusToBorderBrushConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        var hex = value?.ToString() switch { "pending"=>"#fd7e14", "cooking"=>"#0dcaf0", "serving"=>"#2d6a4f", "completed"=>"#adb5bd", _=>"#dee2e6" };
        return new SolidColorBrush(Color.Parse(hex));
    }
    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture) => throw new NotImplementedException();
}

public class AvailableToTextConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        => value is bool b && b ? "Available" : "Unavailable";
    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture) => throw new NotImplementedException();
}

public class AvailableToFgConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        => new SolidColorBrush(Color.Parse(value is bool b && b ? "#0a3622" : "#842029"));
    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture) => throw new NotImplementedException();
}

public class AvailableToBgConverter : IValueConverter
{
    public object Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        => new SolidColorBrush(Color.Parse(value is bool b && b ? "#d1e7dd" : "#f8d7da"));
    public object ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture) => throw new NotImplementedException();
}
