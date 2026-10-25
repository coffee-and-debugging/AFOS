using AFOS.Desktop.Helpers;
using AFOS.Desktop.Models;
using Npgsql;

namespace AFOS.Desktop.Database;

public class DatabaseService
{
    private static DatabaseService? _instance;
    public static DatabaseService Instance => _instance ??= new DatabaseService();

    private string ConnStr => AppConfig.ConnectionString;

    // ─── Auth ───────────────────────────────────────────────────────────────

    public async Task<User?> AuthenticateAsync(string username, string password)
    {
        await using var conn = new NpgsqlConnection(ConnStr);
        await conn.OpenAsync();

        await using var cmd = new NpgsqlCommand(
            // Deactivated and payroll-only staff ("staff" role, no password) cannot sign in
            "SELECT id, username, password, role, name FROM \"User\" " +
            "WHERE username = @u AND active AND password IS NOT NULL AND role IN ('admin', 'cashier', 'chef')", conn);
        cmd.Parameters.AddWithValue("u", username);

        await using var rdr = await cmd.ExecuteReaderAsync();
        if (!await rdr.ReadAsync()) return null;

        var user = new User
        {
            Id       = rdr.GetString(0),
            Username = rdr.GetString(1),
            Password = rdr.GetString(2),
            Role     = rdr.GetString(3),
            Name     = rdr.GetString(4)
        };

        return BCrypt.Net.BCrypt.Verify(password, user.Password) ? user : null;
    }

    public async Task<bool> TestConnectionAsync()
    {
        try
        {
            await using var conn = new NpgsqlConnection(ConnStr);
            await conn.OpenAsync();
            return true;
        }
        catch { return false; }
    }

    // ─── Dashboard ──────────────────────────────────────────────────────────

    public async Task<DashboardStats> GetDashboardStatsAsync()
    {
        var orders = await GetOrdersAsync();
        return new DashboardStats
        {
            TotalOrders       = orders.Count,
            Pending           = orders.Count(o => o.Status == "pending"),
            Cooking           = orders.Count(o => o.Status == "cooking"),
            Serving           = orders.Count(o => o.Status == "serving"),
            Completed         = orders.Count(o => o.Status == "completed"),
            RevenueCollected  = orders.Where(o => o.PaymentStatus == "paid").Sum(o => o.TotalAmount),
            CashPending       = orders.Where(o => o.PaymentStatus == "pending_counter").Sum(o => o.TotalAmount),
            Orders            = orders
        };
    }

    // ─── Orders ─────────────────────────────────────────────────────────────

    public async Task<List<Order>> GetOrdersAsync(string? status = null)
    {
        await using var conn = new NpgsqlConnection(ConnStr);
        await conn.OpenAsync();

        var sql = @"SELECT id, ""tableId"", ""tableNumber"", ""customerNote"",
                           status, ""paymentStatus"", ""paymentMethod"",
                           ""totalAmount"", ""createdAt"", ""updatedAt""
                    FROM ""Order""";
        if (status != null) sql += " WHERE status = @s";
        sql += " ORDER BY \"createdAt\" DESC";

        await using var cmd = new NpgsqlCommand(sql, conn);
        if (status != null) cmd.Parameters.AddWithValue("s", status);

        var orders = new List<Order>();
        await using var rdr = await cmd.ExecuteReaderAsync();
        while (await rdr.ReadAsync())
        {
            orders.Add(new Order
            {
                Id            = rdr.GetString(0),
                TableId       = rdr.GetString(1),
                TableNumber   = rdr.GetInt32(2),
                CustomerNote  = rdr.IsDBNull(3) ? null : rdr.GetString(3),
                Status        = rdr.GetString(4),
                PaymentStatus = rdr.GetString(5),
                PaymentMethod = rdr.IsDBNull(6) ? null : rdr.GetString(6),
                TotalAmount   = rdr.GetDecimal(7),
                CreatedAt     = rdr.GetDateTime(8),
                UpdatedAt     = rdr.GetDateTime(9)
            });
        }
        rdr.Close();

        // Load items for each order
        foreach (var order in orders)
            order.Items = await GetOrderItemsAsync(conn, order.Id);

        return orders;
    }

    private static async Task<List<OrderItem>> GetOrderItemsAsync(NpgsqlConnection conn, string orderId)
    {
        await using var cmd = new NpgsqlCommand(
            @"SELECT id, ""orderId"", ""menuItemId"", name, price, quantity, subtotal
              FROM ""OrderItem"" WHERE ""orderId"" = @oid", conn);
        cmd.Parameters.AddWithValue("oid", orderId);

        var items = new List<OrderItem>();
        await using var rdr = await cmd.ExecuteReaderAsync();
        while (await rdr.ReadAsync())
        {
            items.Add(new OrderItem
            {
                Id         = rdr.GetString(0),
                OrderId    = rdr.GetString(1),
                MenuItemId = rdr.GetString(2),
                Name       = rdr.GetString(3),
                Price      = rdr.GetDecimal(4),
                Quantity   = rdr.GetInt32(5),
                Subtotal   = rdr.GetDecimal(6)
            });
        }
        return items;
    }

    public async Task<bool> UpdateOrderStatusAsync(string orderId, string newStatus)
    {
        await using var conn = new NpgsqlConnection(ConnStr);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand(
            "UPDATE \"Order\" SET status = @s, \"updatedAt\" = NOW() WHERE id = @id", conn);
        cmd.Parameters.AddWithValue("s",  newStatus);
        cmd.Parameters.AddWithValue("id", orderId);
        return await cmd.ExecuteNonQueryAsync() > 0;
    }

    public async Task<bool> ConfirmPaymentAsync(string orderId)
    {
        await using var conn = new NpgsqlConnection(ConnStr);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand(
            @"UPDATE ""Order"" SET ""paymentStatus"" = 'paid',
                                  ""paymentMethod""  = 'counter',
                                  ""updatedAt""      = NOW()
              WHERE id = @id", conn);
        cmd.Parameters.AddWithValue("id", orderId);
        return await cmd.ExecuteNonQueryAsync() > 0;
    }

    // ─── Menu ────────────────────────────────────────────────────────────────

    public async Task<List<Models.MenuItem>> GetMenuItemsAsync()
    {
        await using var conn = new NpgsqlConnection(ConnStr);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand(
            "SELECT id, name, description, price, category, available, \"imageUrl\" FROM \"MenuItem\" ORDER BY category, name", conn);

        var items = new List<Models.MenuItem>();
        await using var rdr = await cmd.ExecuteReaderAsync();
        while (await rdr.ReadAsync())
        {
            items.Add(new Models.MenuItem
            {
                Id          = rdr.GetInt32(0),
                Name        = rdr.GetString(1),
                Description = rdr.IsDBNull(2) ? "" : rdr.GetString(2),
                Price       = rdr.GetDecimal(3),
                Category    = rdr.GetString(4),
                Available   = rdr.GetBoolean(5),
                ImageUrl    = rdr.IsDBNull(6) ? null : rdr.GetString(6)
            });
        }
        return items;
    }

    public async Task<Models.MenuItem?> CreateMenuItemAsync(Models.MenuItem item)
    {
        await using var conn = new NpgsqlConnection(ConnStr);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand(
            @"INSERT INTO ""MenuItem"" (name, description, price, category, available, ""imageUrl"")
              VALUES (@n, @d, @p, @c, @a, @img)
              RETURNING id", conn);
        cmd.Parameters.AddWithValue("n",   item.Name);
        cmd.Parameters.AddWithValue("d",   item.Description);
        cmd.Parameters.AddWithValue("p",   item.Price);
        cmd.Parameters.AddWithValue("c",   item.Category);
        cmd.Parameters.AddWithValue("a",   item.Available);
        cmd.Parameters.AddWithValue("img", (object?)item.ImageUrl ?? DBNull.Value);

        var newId = await cmd.ExecuteScalarAsync();
        if (newId == null) return null;
        item.Id = System.Convert.ToInt32(newId);
        return item;
    }

    public async Task<bool> UpdateMenuItemAsync(Models.MenuItem item)
    {
        await using var conn = new NpgsqlConnection(ConnStr);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand(
            @"UPDATE ""MenuItem"" SET name = @n, description = @d, price = @p,
                                     category = @c, available = @a, ""imageUrl"" = @img
              WHERE id = @id", conn);
        cmd.Parameters.AddWithValue("n",   item.Name);
        cmd.Parameters.AddWithValue("d",   item.Description);
        cmd.Parameters.AddWithValue("p",   item.Price);
        cmd.Parameters.AddWithValue("c",   item.Category);
        cmd.Parameters.AddWithValue("a",   item.Available);
        cmd.Parameters.AddWithValue("img", (object?)item.ImageUrl ?? DBNull.Value);
        cmd.Parameters.AddWithValue("id",  item.Id);
        return await cmd.ExecuteNonQueryAsync() > 0;
    }

    public async Task<bool> ToggleMenuItemAvailabilityAsync(int id, bool available)
    {
        await using var conn = new NpgsqlConnection(ConnStr);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand(
            "UPDATE \"MenuItem\" SET available = @a WHERE id = @id", conn);
        cmd.Parameters.AddWithValue("a",  available);
        cmd.Parameters.AddWithValue("id", id);
        return await cmd.ExecuteNonQueryAsync() > 0;
    }

    public async Task<bool> DeleteMenuItemAsync(int id)
    {
        await using var conn = new NpgsqlConnection(ConnStr);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand("DELETE FROM \"MenuItem\" WHERE id = @id", conn);
        cmd.Parameters.AddWithValue("id", id);
        return await cmd.ExecuteNonQueryAsync() > 0;
    }

    // ─── Tables ─────────────────────────────────────────────────────────────

    public async Task<List<Table>> GetTablesAsync()
    {
        await using var conn = new NpgsqlConnection(ConnStr);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand(
            "SELECT id, number FROM \"Table\" ORDER BY number", conn);

        var tables = new List<Table>();
        await using var rdr = await cmd.ExecuteReaderAsync();
        while (await rdr.ReadAsync())
            tables.Add(new Table { Id = rdr.GetString(0), Number = rdr.GetInt32(1) });
        return tables;
    }

    /// <summary>The "Guest ordering address" from Settings (empty = detect automatically).</summary>
    public async Task<string> GetQrBaseUrlAsync()
    {
        await using var conn = new NpgsqlConnection(ConnStr);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand("SELECT \"qrBaseUrl\" FROM \"Restaurant\" WHERE id = 1", conn);
        return (await cmd.ExecuteScalarAsync()) as string ?? "";
    }

    public async Task<Table?> CreateTableAsync(int number)
    {
        var id = NetworkHelper.NewTableId();
        await using var conn = new NpgsqlConnection(ConnStr);
        await conn.OpenAsync();

        // Check duplicate
        await using var check = new NpgsqlCommand(
            "SELECT 1 FROM \"Table\" WHERE number = @n", conn);
        check.Parameters.AddWithValue("n", number);
        var exists = await check.ExecuteScalarAsync();
        if (exists != null) return null; // duplicate

        await using var cmd = new NpgsqlCommand(
            "INSERT INTO \"Table\" (id, number) VALUES (@id, @n)", conn);
        cmd.Parameters.AddWithValue("id", id);
        cmd.Parameters.AddWithValue("n",  number);
        await cmd.ExecuteNonQueryAsync();
        return new Table { Id = id, Number = number };
    }

    public async Task<bool> DeleteTableAsync(string id)
    {
        await using var conn = new NpgsqlConnection(ConnStr);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand("DELETE FROM \"Table\" WHERE id = @id", conn);
        cmd.Parameters.AddWithValue("id", id);
        return await cmd.ExecuteNonQueryAsync() > 0;
    }
}
