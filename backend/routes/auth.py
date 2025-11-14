"""
인증 및 회원 관리 API 라우트
"""
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel
from auth.login import login_member, get_current_user, logout_member
from auth.member import add_member, update_member, delete_member, get_member_by_id, get_total_member_count

# 인증 라우터 (prefix 없음)
auth_router = APIRouter()


# ============================================================
# Pydantic 모델 정의
# ============================================================

class LoginRequest(BaseModel):
    id: str
    password: str


class AddMemberRequest(BaseModel):
    id: str
    password: str
    name: str
    phone: str
    email: str
    member_role: str = 'R2'
    member_grade: str = 'G2'


class UpdateMemberRequest(BaseModel):
    id: str
    name: str | None = None
    phone: str | None = None
    email: str | None = None
    password: str | None = None
    member_role: str | None = None
    member_grade: str | None = None


# ============================================================
# 인증 엔드포인트
# ============================================================

@auth_router.post("/login")
def login_endpoint(data: LoginRequest, request: Request):
    """로그인"""
    result = login_member(data.id, data.password, request.session)
    if "error" in result:
        raise HTTPException(status_code=401, detail=result["error"])
    return result


@auth_router.get("/logout")
def logout_endpoint(request: Request):
    """로그아웃"""
    return logout_member(request.session)


@auth_router.get("/me")
def get_current_user_endpoint(request: Request):
    """현재 사용자 정보 조회"""
    result = get_current_user(request.session)
    if "error" in result:
        raise HTTPException(status_code=401, detail=result["error"])
    return result


# ============================================================
# 회원 관리 엔드포인트
# ============================================================

@auth_router.post("/member/add")
def add_member_endpoint(data: AddMemberRequest):
    """회원가입"""
    try:
        member_id = add_member(
            id=data.id,
            password=data.password,
            name=data.name,
            phone=data.phone,
            email=data.email,
            member_role=data.member_role,
            member_grade=data.member_grade
        )
        return {"message": "Member added successfully", "member_id": member_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@auth_router.get("/member/me")
def get_my_member_info(request: Request):
    """회원 정보 조회 (본인)"""
    session_user = get_current_user(request.session)
    if "error" in session_user:
        raise HTTPException(status_code=401, detail=session_user["error"])

    member_id = session_user["member_id"]
    member = get_member_by_id(member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    return member


@auth_router.put("/member/update")
def update_member_endpoint(data: UpdateMemberRequest):
    """회원정보 수정"""
    success = update_member(
        id=data.id,
        name=data.name,
        phone=data.phone,
        email=data.email,
        password=data.password,
        member_role=data.member_role,
        member_grade=data.member_grade
    )
    if not success:
        raise HTTPException(status_code=400, detail="No fields to update or member not found")
    return {"message": "Member updated successfully"}


@auth_router.delete("/member/delete/{member_id}")
def delete_member_endpoint(member_id: str, response: Response):
    """회원 삭제"""
    success = delete_member(member_id)
    if not success:
        raise HTTPException(status_code=404, detail="Member not found")

    # 세션 쿠키 삭제 → 브라우저에서 로그아웃 처리
    response.delete_cookie(key="session")

    return {"message": "Member deleted successfully"}


@auth_router.get("/member/admin/{member_id}")
def get_member_endpoint_admin(member_id: str):
    """회원 정보 조회 - 관리자용"""
    member = get_member_by_id(member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    return member


@auth_router.get("/member/count")
def get_member_count():
    """
    전체 회원 수 조회 API (member_role='R2'만)
    """
    try:
        total = get_total_member_count()
        return {"total_members": total}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@auth_router.get("/member/{member_id}")
def get_member_endpoint(member_id: str):
    """회원 정보 조회"""
    member = get_member_by_id(member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    return member
