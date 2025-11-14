# login.py
from passlib.context import CryptContext
from psycopg2.extras import RealDictCursor
from core.db_conn import PostgresDB
from auth.member import get_member_by_id

# ✅ 비밀번호 암호화
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ✅ DB 커넥션 풀
db = PostgresDB()


def login_member(user_id: str, password: str, session: dict):
    """
    로그인 처리
    session: 라우터에서 전달되는 세션(dict)
    """
    conn = db.get_conn()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    try:
        cursor.execute(
            """
            SELECT member_id, id, password, name, member_role, member_grade
            FROM member_info
            WHERE id = %s
            """,
            (user_id,),
        )
        row = cursor.fetchone()

        if not row or not pwd_context.verify(password, row["password"]):
            return {"error": "아이디나 패스워드가 유효하지 않습니다."}

        # 세션 저장
        session["user"] = {
            "member_id": int(row["member_id"]),
            "member_role": row["member_role"],
        }

        # member_log 업데이트
        cursor.execute(
            """
            INSERT INTO member_log (member_id, create_date, date_of_connection, access_count)
            VALUES (%s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1)
            ON CONFLICT (member_id)
            DO UPDATE SET 
                date_of_connection = CURRENT_TIMESTAMP,
                access_count = member_log.access_count + 1,
                update_date = CURRENT_TIMESTAMP
            """,
            (row["member_id"],),
        )
        conn.commit()

        return {"message": f"Welcome {row['name']}", "user": session["user"]}

    finally:
        cursor.close()
        db.release_conn(conn)


def logout_member(session: dict):
    """
    로그아웃 처리
    """
    session.clear()
    return {"message": "Logged out successfully"}


# 세션에 로그인 정보가 있는지 확인
def get_current_user(session: dict):
    """
    현재 로그인한 사용자 조회
    """
    user = session.get("user")
    if not user:
        return {"error": "Not logged in"}
    return user
