/**
 * 年龄计算工具函数
 */

/**
 * 根据生日计算年龄
 * @param {string|Date} birthday - 生日
 * @returns {string} 年龄字符串，如果无法计算则返回空字符串
 */
export function calculateAge(birthday) {
    if (!birthday) {
        return '';
    }

    try {
        const birthDate = new Date(birthday);
        if (isNaN(birthDate.getTime())) {
            console.error('生日格式无效:', birthday);
            return '';
        }

        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();

        // 如果今年生日还没到，年龄减1
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }

        if (age < 0) {
            console.warn('计算出的年龄为负数:', { birthday, age });
            return '';
        }

        return age.toString();
    } catch (e) {
        console.error('计算年龄失败:', e);
        return '';
    }
}