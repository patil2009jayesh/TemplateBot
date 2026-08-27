module.exports = {
  apps: [
    {
      name: 'tachos-dev',
      script: 'main.py',
      interpreter: 'python3',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        PYTHONUNBUFFERED: '1',
      },
    },
  ],
};
