UPDATE settings
    SET value = Replace(value, '"', '')
    WHERE Starts_With(key, 'group:')

