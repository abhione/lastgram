from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import bcrypt
from flask_cors import CORS
from flask_jwt_extended import JWTManager, jwt_required, create_access_token, get_jwt_identity
import os
from postmarker.core import PostmarkClient

app = Flask(__name__)
CORS(app)

# Vercel Postgres configuration
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('POSTGRES_URL')
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY')
jwt = JWTManager(app)
db = SQLAlchemy(app)

# Postmark configuration
postmark = PostmarkClient(server_token=os.environ.get('POSTMARK_API_KEY'))

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    role = db.Column(db.String(20), nullable=False)
    is_deceased = db.Column(db.Boolean, default=False)

class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    recipient_email = db.Column(db.String(120), nullable=False)
    content = db.Column(db.Text, nullable=False)
    scheduled_date = db.Column(db.DateTime, nullable=False)
    is_sent = db.Column(db.Boolean, default=False)

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    hashed_password = bcrypt.hashpw(data['password'].encode('utf-8'), bcrypt.gensalt())
    new_user = User(
        username=data['username'], 
        email=data['email'], 
        password_hash=hashed_password,
        role='sender'  # Default role is sender
    )
    db.session.add(new_user)
    db.session.commit()
    return jsonify({"message": "User registered successfully"}), 201

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    user = User.query.filter_by(email=data['email']).first()
    if user and bcrypt.checkpw(data['password'].encode('utf-8'), user.password_hash):
        access_token = create_access_token(identity=user.id)
        return jsonify(access_token=access_token, role=user.role), 200
    return jsonify({"message": "Invalid credentials"}), 401

@app.route('/api/admin/users', methods=['GET'])
@jwt_required()
def get_users():
    current_user = User.query.get(get_jwt_identity())
    if current_user.role != 'admin':
        return jsonify({"message": "Unauthorized"}), 403
    users = User.query.all()
    return jsonify([{"id": user.id, "username": user.username, "email": user.email, "role": user.role, "is_deceased": user.is_deceased} for user in users]), 200

@app.route('/api/admin/mark_deceased/<int:user_id>', methods=['POST'])
@jwt_required()
def mark_user_deceased(user_id):
    current_user = User.query.get(get_jwt_identity())
    if current_user.role != 'admin':
        return jsonify({"message": "Unauthorized"}), 403
    user = User.query.get(user_id)
    if user:
        user.is_deceased = True
        db.session.commit()
        # Send invitations to recipients
        messages = Message.query.filter_by(sender_id=user.id, is_sent=False).all()
        for message in messages:
            postmark.emails.send(
                From="noreply@lastgram.com",
                To=message.recipient_email,
                Subject="You have a message from Lastgram",
                TextBody="You have received a message from a deceased sender. Please log in to Lastgram to view it."
            )
            message.is_sent = True
        db.session.commit()
        return jsonify({"message": "User marked as deceased and invitations sent"}), 200
    return jsonify({"message": "User not found"}), 404

@app.route('/api/sender/messages', methods=['GET', 'POST'])
@jwt_required()
def handle_messages():
    current_user = User.query.get(get_jwt_identity())
    if current_user.role != 'sender':
        return jsonify({"message": "Unauthorized"}), 403
    
    if request.method == 'GET':
        messages = Message.query.filter_by(sender_id=current_user.id).all()
        return jsonify([{
            'id': message.id,
            'recipient_email': message.recipient_email,
            'content': message.content,
            'scheduled_date': message.scheduled_date.isoformat(),
            'is_sent': message.is_sent
        } for message in messages]), 200
    
    elif request.method == 'POST':
        data = request.json
        new_message = Message(
            sender_id=current_user.id,
            recipient_email=data['recipient_email'],
            content=data['content'],
            scheduled_date=datetime.fromisoformat(data['scheduled_date'])
        )
        db.session.add(new_message)
        db.session.commit()
        return jsonify({"message": "Message scheduled successfully"}), 201

if __name__ == '__main__':
    db.create_all()
    app.run(debug=True)
