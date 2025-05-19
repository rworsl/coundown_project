from flask import Flask, render_template, request, jsonify, session
from flask_socketio import SocketIO, emit
import os
import json
import time
import uuid
from datetime import datetime
from config import Config

app = Flask(__name__)
app.config.from_object(Config)
socketio = SocketIO(app, cors_allowed_origins="*")

# In-memory storage for timers
# In production, consider using Redis or a database
timers = {}

@app.route('/')
def index():
    """Main page with the timer display"""
    timer_id = request.args.get('id')
    is_controller = False
    
    # If no timer ID is provided, create a new one
    if not timer_id:
        timer_id = str(uuid.uuid4())
        timers[timer_id] = {
            'duration': 60 * 10,  # Default: 10 minutes
            'remaining': 60 * 10,
            'status': 'paused',
            'last_update': time.time()
        }
        is_controller = True
    
    # If timer doesn't exist, create it
    if timer_id not in timers:
        timers[timer_id] = {
            'duration': 60 * 10,
            'remaining': 60 * 10,
            'status': 'paused',
            'last_update': time.time()
        }
    
    return render_template('index.html', 
                          timer_id=timer_id, 
                          is_controller=is_controller,
                          timer=timers[timer_id])

@app.route('/control/<timer_id>')
def control(timer_id):
    """Controller page for a specific timer"""
    if timer_id not in timers:
        return "Timer not found", 404
    
    return render_template('control.html', 
                          timer_id=timer_id,
                          timer=timers[timer_id])

@app.route('/api/timer/<timer_id>', methods=['GET'])
def get_timer(timer_id):
    """Get timer status"""
    if timer_id not in timers:
        return jsonify({"error": "Timer not found"}), 404
    
    # Update remaining time if timer is running
    if timers[timer_id]['status'] == 'running':
        elapsed = time.time() - timers[timer_id]['last_update']
        timers[timer_id]['remaining'] -= elapsed
        timers[timer_id]['last_update'] = time.time()
        
        # Check if timer has finished
        if timers[timer_id]['remaining'] <= 0:
            timers[timer_id]['remaining'] = 0
            timers[timer_id]['status'] = 'finished'
    
    return jsonify(timers[timer_id])

@app.route('/api/timer/<timer_id>', methods=['POST'])
def update_timer(timer_id):
    """Update timer settings or state"""
    if timer_id not in timers:
        return jsonify({"error": "Timer not found"}), 404
    
    data = request.json
    
    # Handle command to start/pause/reset
    if 'command' in data:
        if data['command'] == 'start':
            timers[timer_id]['status'] = 'running'
            timers[timer_id]['last_update'] = time.time()
            socketio.emit('timer_update', {'timer_id': timer_id, 'status': 'running'})
        
        elif data['command'] == 'pause':
            # Update remaining time before pausing
            if timers[timer_id]['status'] == 'running':
                elapsed = time.time() - timers[timer_id]['last_update']
                timers[timer_id]['remaining'] -= elapsed
            timers[timer_id]['status'] = 'paused'
            socketio.emit('timer_update', {'timer_id': timer_id, 'status': 'paused'})
        
        elif data['command'] == 'reset':
            timers[timer_id]['remaining'] = timers[timer_id]['duration']
            timers[timer_id]['status'] = 'paused'
            socketio.emit('timer_update', {'timer_id': timer_id, 'status': 'paused', 'reset': True})
    
    # Handle duration change
    if 'duration' in data:
        try:
            new_duration = int(data['duration'])
            if new_duration > 0:
                timers[timer_id]['duration'] = new_duration
                # Only update remaining time if timer is paused or it's a reset
                if timers[timer_id]['status'] == 'paused' or data.get('command') == 'reset':
                    timers[timer_id]['remaining'] = new_duration
                socketio.emit('timer_update', {
                    'timer_id': timer_id, 
                    'duration': new_duration,
                    'remaining': timers[timer_id]['remaining']
                })
        except ValueError:
            return jsonify({"error": "Invalid duration"}), 400
    
    return jsonify(timers[timer_id])

@socketio.on('connect')
def on_connect():
    """Handle client connection"""
    print(f"Client connected: {request.sid}")

@socketio.on('join')
def on_join(data):
    """Handle client joining a timer room"""
    timer_id = data.get('timer_id')
    if timer_id:
        print(f"Client {request.sid} joined timer {timer_id}")

@socketio.on('disconnect')
def on_disconnect():
    """Handle client disconnection"""
    print(f"Client disconnected: {request.sid}")

# Clean up old timers periodically (optional for production)
@app.cli.command("clean-timers")
def clean_timers():
    """Clean up timers that haven't been used for more than 24 hours"""
    current_time = time.time()
    to_delete = []
    
    for timer_id, timer in timers.items():
        # If timer hasn't been updated in 24 hours
        if current_time - timer['last_update'] > 86400:
            to_delete.append(timer_id)
    
    for timer_id in to_delete:
        del timers[timer_id]
    
    print(f"Cleaned up {len(to_delete)} timers")

if __name__ == '__main__':
    socketio.run(app, debug=Config.DEBUG, host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
