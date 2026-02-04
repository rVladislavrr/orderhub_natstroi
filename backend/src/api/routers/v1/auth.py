from fastapi import APIRouter, status

router = APIRouter()


@router.post(
    "/register",
    response_model=...,
    status_code=status.HTTP_201_CREATED,
    responses={
        201: {
            "description": "User registered successfully",
            "headers": {
                "Set-Cookie": {
                    "description": "Session cookie",
                    "schema": {"type": "string"}
                }
            },
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "message": "Account created successfully",
                        "data": {
                            "user": {
                                "id": "123e4567-e89b-12d3-a456-426614174000",
                                "email": "user@example.com",
                                "username": "johndoe",
                                "is_verified": False,
                                "created_at": "2024-01-15T10:30:00Z"
                            },
                            "session": {
                                "is_active": True,
                                "requires_verification": True
                            }
                        },
                        "meta": {
                            "email_sent": True,
                            "verification_required": True
                        }
                    }
                }
            }
        },
        400: {"detail": "Invalid input data"},
        409: {
            "description": "User already registered",
            "content": {
                "application/json": {
                    "example": {

                        "detail":
                            {"msg": "User already exists",
                             'request_id': "12348041802390480"}

                    }
                }
            }
        }
    },
    summary="Register new user",
    description="Creates a new user account with limited session"
)
async def register():
    pass
