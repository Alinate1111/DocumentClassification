const API_BASE = "http://localhost:8000"; // 백엔드 주소

// 로그인 상태 확인
export async function isLoggedIn(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/me`, {
      method: "GET",
      credentials: "include", // 쿠키 전송
    });
    return res.ok; // 200이면 로그인 상태
  } catch (error) {
    console.error("isLoggedIn error:", error);
    return false;
  }
}

// 로그인 (서버 로그인 API 호출)
export async function login(id: string, password: string): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: "POST",
      credentials: "include", // 쿠키 전송
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, password }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.detail || "Login failed");
    }

    const data = await res.json();
    return data.user; // 서버에서 반환한 유저 정보
  } catch (error) {
    console.error("login error:", error);
    throw error;
  }
}

// 로그아웃 (서버 로그아웃 API 호출)
export async function logout(): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/logout`, {
      method: "GET",
      credentials: "include", // 쿠키 전송
    });

    if (!res.ok) {
      throw new Error("Logout failed");
    }
  } catch (error) {
    console.error("logout error:", error);
    throw error;
  }
}
