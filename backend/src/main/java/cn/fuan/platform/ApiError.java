package cn.fuan.platform;

public class ApiError extends RuntimeException {
    final int status;
    final String code;
    public ApiError(int status, String code, String message) { super(message); this.status=status; this.code=code; }
    public static ApiError invalid(String message) { return new ApiError(422,"XQ-VALIDATION-422",message); }
    public static ApiError forbidden() { return new ApiError(403,"XQ-AUTH-403","当前身份无权执行此操作"); }
    public static ApiError missing() { return new ApiError(404,"XQ-RESOURCE-404","对象不存在或不可访问"); }
    public static ApiError conflict(String message) { return new ApiError(409,"XQ-CONFLICT-409",message); }
}
