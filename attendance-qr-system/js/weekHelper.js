const WeekHelper = {
    ACADEMIC_START: new Date('2025-05-10'),
    
    getWeekNumber: function(date) {
        const startDate = new Date(this.ACADEMIC_START);
        const currentDate = new Date(date);
        
        const diffTime = currentDate - startDate;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        let weekNum = Math.floor(diffDays / 7) + 1;
        
        if (weekNum < 1) weekNum = 1;
        if (weekNum > 16) weekNum = 16;
        
        return weekNum;
    },
    
    getCurrentWeek: function() {
        return this.getWeekNumber(new Date());
    },
    
    formatWeek: function(weekNum) {
        return `Week ${weekNum}`;
    }
};