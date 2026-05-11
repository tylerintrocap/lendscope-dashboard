const Airtable = require('airtable');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString();
    const [username, password] = credentials.split(':');

    const validUsers = [
      {
        username: process.env.ADMIN_USERNAME,
        password: process.env.ADMIN_PASSWORD,
        role: 'admin'
      },
      {
        username: process.env.SALES_USERNAME,
        password: process.env.SALES_PASSWORD,
        role: 'sales'
      }
    ];

    const authenticatedUser = validUsers.find(user =>
      username === user.username && password === user.password
    );

    if (!authenticatedUser) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Invalid credentials' }),
      };
    }

    const base = new Airtable({ apiKey: process.env.AIRTABLE_TOKEN }).base(process.env.AIRTABLE_BASE_ID);

    if (event.httpMethod === 'GET') {
      const { tableName, startDate, endDate } = event.queryStringParameters || {};

      if (!tableName) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'tableName parameter required' }),
        };
      }

      const records = await base(tableName).select({ maxRecords: 1000 }).all();

      let filteredRecords = records;

      if (startDate && endDate) {
        filteredRecords = records.filter(record => {
          const dateField = record.fields.Date;
          if (!dateField) return false;

          // Compare date strings directly (YYYY-MM-DD) to avoid timezone issues
          // Airtable stores dates as "2026-05-10" or "2026-05-10T20:43:00.000Z"
          // Extract just the YYYY-MM-DD part for comparison
          const recordDateStr = dateField.substring(0, 10);
          return recordDateStr >= startDate && recordDateStr <= endDate;
        });
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          records: filteredRecords.map(r => ({
            id: r.id,
            fields: r.fields,
            createdTime: r._rawJson.createdTime
          }))
        }),
      };
    }

    if (event.httpMethod === 'PATCH' || event.httpMethod === 'POST') {
      const { tableName, recordId, fields } = JSON.parse(event.body);

      await base(tableName).update(recordId, fields);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true }),
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
