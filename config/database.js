module.exports = {
    development: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        username: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'ai_orchestrator_dev',
        dialect: 'mysql',
        logging: console.log,
        pool: {
            max: 10,
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    },
    test: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        username: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'ai_orchestrator_test',
        dialect: 'mysql',
        logging: false,
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    },
    production: {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 3306,
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        dialect: 'mysql',
        logging: false,
        pool: {
            max: 20,
            min: 5,
            acquire: 60000,
            idle: 30000
        },
        replication: {
            read: [
                { host: process.env.DB_READ_HOST || process.env.DB_HOST }
            ],
            write: { host: process.env.DB_HOST }
        }
    }
};
