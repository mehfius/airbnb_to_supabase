import { createClient } from '@supabase/supabase-js';

export const log_service = {
  client: createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE!
  ),

  async log_execution(log_data: {
    room_ids: string[],
    execution_time: string,
    error_messages: string[] | null,
    failed_room_ids: string[] | null,
    failed_count: number,
    successful_count: number,
    html_sidebar: string[] | null
  }): Promise<void> {
    try {
      const { error } = await this.client
        .from('logs')
        .insert(log_data);
      
      if (error) throw error;
    } catch (logError) {
      console.error('Failed to log execution:', logError);
    }
  },

  async prepare_log_data(
    room_ids: string[],
    execution_time: string,
    error_messages: string[],
    failed_room_ids: string[],
    successful_count: number,
    html_sidebar: string[] | null
  ) {
    const failed_count = failed_room_ids.length;
    
    return {
      room_ids,
      execution_time,
      error_messages: error_messages.length > 0 ? error_messages : null,
      failed_room_ids: failed_room_ids.length > 0 ? failed_room_ids : null,
      failed_count,
      successful_count,
      html_sidebar
    };
  }
}; 