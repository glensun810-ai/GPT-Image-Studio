// PM2 进程管理配置
// 用法: pm2 start deployment/pm2.config.cjs
module.exports = {
  apps: [
    {
      name: 'gpt-image-studio',
      script: 'dist/server.js',
      cwd: '/www/wwwroot/jhw-ai.com/GPT-Image-Studio',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        JWT_SECRET: process.env.JWT_SECRET,
      },
      instances: 1,
      exec_mode: 'fork',
      // 自动重启
      max_restarts: 10,
      restart_delay: 3000,
      // 日志
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      merge_logs: true,
      // 资源限制
      max_memory_restart: '512M',
    },
  ],
};
