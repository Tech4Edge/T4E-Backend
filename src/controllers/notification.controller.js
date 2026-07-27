import Notification from "../models/notification.model.js";

export const getNotifications = async (req, res) => {
  try {
    const limit = Math.min(50, parseInt(req.query.limit) || 50);
    const notifications = await Notification.find()
      .sort({ createdAt: -1 })
      .limit(limit);
      
    const unreadCount = await Notification.countDocuments({ isRead: false });

    return res.json({ notifications, unreadCount });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch notifications" });
  }
};

export const markAllRead = async (req, res) => {
  try {
    await Notification.updateMany({ isRead: false }, { $set: { isRead: true } });
    return res.json({ message: "All notifications marked as read" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update notifications" });
  }
};

export const deleteNotification = async (req, res) => {
  try {
    const deleted = await Notification.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Notification not found" });
    }
    return res.json({ message: "Notification deleted" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete notification" });
  }
};

export const deleteAllNotifications = async (req, res) => {
  try {
    await Notification.deleteMany({});
    return res.json({ message: "All notifications deleted" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to clear notifications" });
  }
};
