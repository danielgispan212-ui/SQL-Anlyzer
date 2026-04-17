const sql = require('mssql');

const config = {
    server: 'localhost',
    database: 'MyDB',
    user: 'testuser',
    password: 'Test1234!',
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

(async () => {
    try {
        console.log('🔹 מנסה להתחבר...');
        const pool = await sql.connect(config);
        console.log('✅ חיבור הצליח!');

        const result = await pool.request().query('SELECT 1 AS test');
        console.log(result.recordset);

    } catch (err) {
        console.error('❌ שגיאה:', err);
    }
})();