import os

class Config:
    """Application configuration settings"""
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'a-very-secret-key-for-development'
    DEBUG = os.environ.get('FLASK_ENV') == 'development'
    # Add other configuration options here
